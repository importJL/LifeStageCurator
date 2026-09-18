"""Enrichment orchestration: metadata, dedupe, summary, taxonomy.

Ties together the pieces described in uc1_specs.md 2.2-2.8. The entry point is
:meth:`EnrichmentService.enrich`, which never raises to the caller and instead
returns success/partial/error states with an errors list.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid

from .budget import TokenBudget
from .cache import TTLCache
from .config import Settings
from .duplicates import DuplicateStore
from .embeddings import EmbeddingBackend
from .labelling import (
    SummaryResult,
    enrich_with_llm,
    estimate_minutes,
    extract_first_paragraph,
    offline_taxonomy,
    taxonomy_with_llm,
)
from .metadata import FetchedMetadata, UnsafeURLError, canonicalize_url, fetch_metadata, sanitize_url
from .models import (
    ContentMetadata,
    EnrichmentError,
    EnrichmentMeta,
    EnrichmentStatus,
    EnrichRequest,
    EnrichResponse,
    TaxonomySuggestion,
)
from .obs import log_enrichment
from .providers.base import InferenceProvider
from .providers.mock import MockProvider
from .providers.openrouter import OpenRouterProvider

logger = logging.getLogger(__name__)


def build_provider(settings: Settings) -> InferenceProvider:
    if settings.ai_router_provider.lower() == "mock":
        return MockProvider(model=settings.ai_router_model)
    return OpenRouterProvider(
        base_url=settings.ai_router_base_url,
        api_key=settings.ai_router_api_key,
        model=settings.ai_router_model,
        app_url=settings.ai_router_app_url,
        app_name=settings.ai_router_app_name,
        timeout=settings.ai_call_timeout_seconds,
        max_retries=settings.ai_max_retries,
    )


class EnrichmentService:
    def __init__(
        self,
        settings: Settings,
        *,
        provider: InferenceProvider | None = None,
        store: DuplicateStore | None = None,
        embeddings: EmbeddingBackend | None = None,
    ) -> None:
        self.settings = settings
        self.provider = provider or build_provider(settings)
        self.store = store or DuplicateStore(settings.resolved(settings.duplicate_store_path))
        self.embeddings = embeddings or EmbeddingBackend(
            model_name=settings.embedding_model,
            enabled=settings.enable_embedding_duplicates,
        )
        self.cache = TTLCache(settings.cache_ttl_seconds)
        self.budget = TokenBudget(
            daily_budget=settings.daily_token_budget,
            request_budget=settings.request_token_budget,
        )

    async def enrich(self, request: EnrichRequest, *, request_id: str = "-") -> EnrichResponse:
        started = time.perf_counter()
        errors: list[EnrichmentError] = []
        tokens_used = 0
        model: str | None = self.provider.model
        offline_used = False
        llm_used = False

        url = request.url
        canonical_url: str | None = None
        if url:
            try:
                canonical_url = canonicalize_url(sanitize_url(url))
            except UnsafeURLError as exc:
                return self._error_response(
                    errors=[EnrichmentError(code="invalid_url", message=str(exc), field="url")],
                    provider=self.provider.name,
                    model=model,
                    started=started,
                )

        cache_key = self._cache_key(canonical_url, request)
        cached_payload = self.cache.get(cache_key) if cache_key else None
        if cached_payload is not None:
            response = EnrichResponse.model_validate(cached_payload)
            response.enrichment_meta.cached = True
            return response

        fetched = FetchedMetadata(url=canonical_url or "")
        text = request.raw_text or ""
        if url:
            fetched, text = await fetch_metadata(
                canonical_url,
                timeout=self.settings.http_fetch_timeout_seconds,
                max_chars=self.settings.max_content_chars,
            )
            if fetched.errors:
                errors.append(
                    EnrichmentError(
                        code="metadata_partial",
                        message="Metadata could not be fully fetched; using available fields.",
                        field="url",
                    )
                )

        metadata = ContentMetadata(
            title=fetched.title or request.title_hint,
            description=fetched.description,
            thumbnail_url=fetched.thumbnail_url,
            published_at=fetched.published_at,
            canonical_url=fetched.canonical_url or canonical_url,
            site_name=fetched.site_name,
        )

        content_hint = None
        if fetched.oembed:
            content_hint = fetched.oembed.get("type") or fetched.oembed.get("_provider")
        elif fetched.content_type:
            content_hint = fetched.content_type

        # --- Duplicate detection ---
        duplicates = []
        embedding: list[float] | None = None
        if request.options.detect_duplicates:
            if canonical_url:
                exact = self.store.find_exact(canonical_url, exclude_content_id=request.existing_content_id)
                if exact:
                    duplicates.append(exact)
            if self.embeddings.available and self.settings.enable_embedding_duplicates:
                embed_text = self._embed_text(metadata, text)
                embedding = await self.embeddings.embed(embed_text)
                near = self.store.find_near(
                    embedding,
                    threshold=self.settings.duplicate_similarity_threshold,
                    exclude_content_id=request.existing_content_id,
                )
                seen = {match.content_id for match in duplicates}
                duplicates.extend(match for match in near if match.content_id not in seen)

        want_offline = request.options.use_offline_labelling or (
            self.settings.use_offline_labelling_default and not request.options.use_llm
        )
        llm_allowed = request.options.use_llm and self._llm_enabled() and self.budget.has_budget(
            estimated_tokens=self.settings.request_token_budget
        )

        # --- Summary + taxonomy (one combined LLM request when both are wanted) ---
        summary: str | None = None
        summary_result = SummaryResult(summary=None)
        taxonomy: TaxonomySuggestion | None = None

        if llm_allowed and request.options.generate_summary:
            summary_result, taxonomy, llm_tokens, llm_model = await enrich_with_llm(
                self.provider,
                title=metadata.title,
                description=metadata.description,
                url=canonical_url,
                text=text,
                content_hint=content_hint,
                timeout=self.settings.enrichment_timeout_seconds,
            )
            tokens_used += llm_tokens
            llm_used = llm_used or summary_result.used_llm or taxonomy is not None
            if llm_model:
                model = llm_model
        elif llm_allowed:
            taxonomy, tax_tokens, tax_model = await taxonomy_with_llm(
                self.provider,
                title=metadata.title,
                description=metadata.description,
                url=canonical_url,
                text=text,
                content_hint=content_hint,
                timeout=self.settings.enrichment_timeout_seconds,
            )
            tokens_used += tax_tokens
            if tax_model:
                model = tax_model
            llm_used = llm_used or taxonomy is not None

        if request.options.generate_summary:
            summary = summary_result.summary or extract_first_paragraph(text or metadata.description or "")
            if summary is None:
                errors.append(
                    EnrichmentError(code="summary_unavailable", message="No summary could be generated.")
                )

        if taxonomy is None and want_offline:
            taxonomy = offline_taxonomy(
                title=metadata.title,
                description=metadata.description,
                text=text,
                url=canonical_url,
                oembed=fetched.oembed,
            )
            offline_used = True

        if taxonomy is None:
            taxonomy = TaxonomySuggestion()
            errors.append(
                EnrichmentError(code="taxonomy_unavailable", message="No taxonomy suggestion could be produced.")
            )
        elif taxonomy.estimated_minutes is None:
            taxonomy.estimated_minutes = estimate_minutes(
                text=text, content_type=taxonomy.content_type, oembed=fetched.oembed
            )

        if request.options.use_llm and not llm_used:
            errors.append(
                EnrichmentError(
                    code="llm_fallback",
                    message="LLM provider was unavailable or slow; used offline labelling and an extractive summary.",
                )
            )

        self.budget.record(tokens_used)

        # --- Persist for future duplicate checks ---
        if request.options.detect_duplicates and canonical_url:
            content_id = request.existing_content_id or str(uuid.uuid4())
            try:
                self.store.record(
                    content_id=content_id,
                    url=url,
                    canonical_url=canonical_url,
                    title=metadata.title,
                    embedding=embedding,
                )
            except Exception as exc:  # noqa: BLE001 - never block the response
                logger.warning("could not record content for dedupe: %s", exc)

        status = self._status(metadata, summary, taxonomy, fetched, errors)
        meta = EnrichmentMeta(
            provider=self.provider.name,
            model=model,
            latency_ms=int((time.perf_counter() - started) * 1000),
            tokens_used=tokens_used,
            offline_labelling_used=offline_used,
            cached=False,
            llm_used=llm_used,
        )
        response = EnrichResponse(
            status=status,
            metadata=metadata,
            summary=summary,
            taxonomy=taxonomy,
            duplicates=duplicates,
            enrichment_meta=meta,
            errors=errors,
        )

        if cache_key:
            self.cache.set(cache_key, response.model_dump(mode="json"))

        log_enrichment(
            self.settings.resolved(self.settings.enrichment_log_path),
            {
                "request_id": request_id,
                "url": canonical_url,
                "status": status.value,
                "provider": self.provider.name,
                "model": model,
                "tokens_used": tokens_used,
                "latency_ms": meta.latency_ms,
                "offline_labelling_used": offline_used,
                "llm_used": llm_used,
                "duplicate_count": len(duplicates),
            },
        )
        return response

    @property
    def llm_configured(self) -> bool:
        return self._llm_enabled()

    def _llm_enabled(self) -> bool:
        if self.provider.name == "mock":
            return True
        return bool(self.settings.ai_router_api_key)

    def _embed_text(self, metadata: ContentMetadata, text: str) -> str:
        parts = [metadata.title or "", metadata.description or "", (text or "")[:2000]]
        return " ".join(part for part in parts if part).strip() or (metadata.canonical_url or "")

    def _cache_key(self, canonical_url: str | None, request: EnrichRequest) -> str | None:
        if canonical_url:
            base = canonical_url
        elif request.raw_text:
            base = "raw:" + hashlib.sha256(request.raw_text.encode("utf-8")).hexdigest()
        else:
            return None
        options = request.options.model_dump()
        signature = hashlib.sha256(json.dumps(options, sort_keys=True).encode("utf-8")).hexdigest()[:12]
        return f"{base}::{signature}"

    def _status(
        self,
        metadata: ContentMetadata,
        summary: str | None,
        taxonomy: TaxonomySuggestion,
        fetched: FetchedMetadata,
        errors: list[EnrichmentError],
    ) -> EnrichmentStatus:
        has_metadata = bool(metadata.title or metadata.description)
        has_value = bool(summary) or bool(taxonomy.primary_life_stage)
        if not has_value and not has_metadata:
            return EnrichmentStatus.error
        if errors or (metadata.canonical_url and fetched.errors) or not summary or not taxonomy.primary_life_stage:
            return EnrichmentStatus.partial
        return EnrichmentStatus.success

    def _error_response(
        self,
        *,
        errors: list[EnrichmentError],
        provider: str,
        model: str | None,
        started: float,
    ) -> EnrichResponse:
        return EnrichResponse(
            status=EnrichmentStatus.error,
            enrichment_meta=EnrichmentMeta(
                provider=provider,
                model=model,
                latency_ms=int((time.perf_counter() - started) * 1000),
            ),
            errors=errors,
        )
