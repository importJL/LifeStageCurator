"""Summary + taxonomy labelling: LLM path and offline (non-LLM) path.

Covers uc1_specs.md 2.2 (summarisation, topic labelling) and 2.5 (offline ML /
rule-based alternative). The offline path runs when requested, when the LLM is
unavailable, or when the token budget is exhausted.
"""

from __future__ import annotations

import asyncio
import logging
import math
import re
from collections.abc import Awaitable
from dataclasses import dataclass
from typing import TypeVar

from .models import TaxonomySuggestion
from .prompts import (
    ENRICHMENT_SCHEMA,
    ENRICHMENT_SYSTEM,
    SUMMARY_SCHEMA,
    SUMMARY_SYSTEM,
    TAXONOMY_SCHEMA,
    TAXONOMY_SYSTEM,
    build_enrichment_prompt,
    build_summary_prompt,
    build_taxonomy_prompt,
)
from .providers.base import InferenceProvider, ProviderError
from .taxonomy import CONTENT_TYPES, LIFE_STAGES, STAGE_KEYWORDS, TOPIC_KEYWORDS

logger = logging.getLogger(__name__)

WORD_LIMIT = 200
WORDS_PER_MINUTE = 230

PODCAST_HOSTS = (
    "podcast", "anchor.fm", "spotify.com/episode", "podcasts.apple.com",
    "buzzsprout", "libsyn", "soundcloud.com", "overcast.fm",
)


T = TypeVar("T")


async def _guard(awaitable: Awaitable[T], timeout: float | None) -> T:
    """Bound a single LLM call so retries cannot outlive the request budget."""
    if timeout and timeout > 0:
        return await asyncio.wait_for(awaitable, timeout)
    return await awaitable


@dataclass
class SummaryResult:
    summary: str | None
    tokens_used: int = 0
    model: str | None = None
    used_llm: bool = False


def _normalise(value: str | None) -> str:
    return (value or "").lower()


def keyword_score(text: str, keywords: list[str]) -> int:
    score = 0
    for keyword in keywords:
        if keyword in text:
            score += 1
    return score


def offline_taxonomy(
    *,
    title: str | None,
    description: str | None,
    text: str,
    url: str | None = None,
    oembed: dict | None = None,
) -> TaxonomySuggestion:
    """Rule/keyword-based labelling that never calls an LLM."""
    headline = _normalise(title)
    body = _normalise(f"{description or ''} {(text or '')[:6000]}")
    combined = f"{headline} {body}"

    stage_scores: dict[str, int] = {}
    for stage, keywords in STAGE_KEYWORDS.items():
        score = keyword_score(headline, keywords) * 3 + keyword_score(body, keywords)
        stage_scores[stage] = score

    best_stage = max(stage_scores, key=lambda stage: stage_scores[stage])
    if stage_scores[best_stage] == 0:
        best_stage = next(iter(LIFE_STAGES))

    allowed_topics = LIFE_STAGES[best_stage]
    topic_scores = {
        topic: keyword_score(combined, TOPIC_KEYWORDS.get(topic, [])) for topic in allowed_topics
    }
    ranked = [topic for topic, score in sorted(topic_scores.items(), key=lambda item: -item[1]) if score > 0]
    sub_topics = ranked[:2] or allowed_topics[:1]

    content_type = _offline_content_type(title, url)
    minutes = estimate_minutes(text=text, content_type=content_type, oembed=oembed)

    return TaxonomySuggestion(
        primary_life_stage=best_stage,
        sub_topics=sub_topics,
        content_type=content_type,
        estimated_minutes=minutes,
    )


def _offline_content_type(title: str | None, url: str | None) -> str:
    haystack = _normalise(f"{title or ''} {url or ''}")
    if any(host in _normalise(url) for host in ("youtube", "youtu.be", "vimeo")):
        return "video"
    if any(host in _normalise(url) for host in PODCAST_HOSTS):
        return "podcast"
    if _normalise(url).endswith(".pdf"):
        return "guide"
    if "checklist" in haystack:
        return "checklist"
    if "template" in haystack or "calculator" in haystack or "worksheet" in haystack:
        return "tool"
    if "guide" in haystack or "how to" in haystack:
        return "guide"
    return "article"


def estimate_minutes(*, text: str, content_type: str, oembed: dict | None = None) -> int | None:
    if oembed:
        seconds = oembed.get("duration_seconds")
        if isinstance(seconds, (int, float)) and seconds > 0:
            return max(1, math.ceil(seconds / 60))
        if content_type == "podcast":
            return None
    words = len((text or "").split())
    if words == 0:
        return None
    return max(1, math.ceil(words / WORDS_PER_MINUTE))


def clamp_summary(summary: str, *, limit: int = WORD_LIMIT) -> str:
    words = summary.split()
    if len(words) <= limit:
        return summary.strip()
    return " ".join(words[:limit]).rstrip(".,;:") + "…"


async def summarize_with_llm(
    provider: InferenceProvider,
    *,
    title: str | None,
    url: str | None,
    text: str,
    timeout: float | None = None,
) -> SummaryResult:
    prompt = build_summary_prompt(title=title, url=url, text=text)
    try:
        result = await _guard(provider.complete(prompt, SUMMARY_SCHEMA, system=SUMMARY_SYSTEM), timeout)
    except TimeoutError:
        logger.warning("summary LLM call timed out after %ss", timeout)
        return SummaryResult(summary=None, used_llm=False)
    except ProviderError as exc:
        logger.warning("summary LLM call failed: %s", exc)
        return SummaryResult(summary=None, used_llm=False)

    summary = result.data.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        return SummaryResult(summary=None, tokens_used=result.tokens_used, model=result.model, used_llm=True)
    return SummaryResult(
        summary=clamp_summary(summary),
        tokens_used=result.tokens_used,
        model=result.model,
        used_llm=True,
    )


async def taxonomy_with_llm(
    provider: InferenceProvider,
    *,
    title: str | None,
    description: str | None,
    url: str | None,
    text: str,
    content_hint: str | None = None,
    timeout: float | None = None,
) -> tuple[TaxonomySuggestion | None, int, str | None]:
    prompt = build_taxonomy_prompt(
        title=title,
        description=description,
        url=url,
        text=text,
        content_hint=content_hint,
    )
    try:
        result = await _guard(provider.complete(prompt, TAXONOMY_SCHEMA, system=TAXONOMY_SYSTEM), timeout)
    except TimeoutError:
        logger.warning("taxonomy LLM call timed out after %ss", timeout)
        return None, 0, None
    except ProviderError as exc:
        logger.warning("taxonomy LLM call failed: %s", exc)
        return None, 0, None

    return _taxonomy_from_data(result.data), result.tokens_used, result.model


def _taxonomy_from_data(data: dict) -> TaxonomySuggestion:
    stage = data.get("primary_life_stage")
    if stage not in LIFE_STAGES:
        stage = None
    content_type = data.get("content_type")
    if content_type not in CONTENT_TYPES:
        content_type = "unknown"

    sub_topics = data.get("sub_topics")
    if not isinstance(sub_topics, list):
        sub_topics = []
    sub_topics = [str(topic) for topic in sub_topics][:5]

    minutes = data.get("estimated_minutes")
    if not isinstance(minutes, int) or minutes <= 0:
        minutes = None

    return TaxonomySuggestion(
        primary_life_stage=stage,
        sub_topics=sub_topics,
        content_type=content_type,
        estimated_minutes=minutes,
    )


async def enrich_with_llm(
    provider: InferenceProvider,
    *,
    title: str | None,
    description: str | None,
    url: str | None,
    text: str,
    content_hint: str | None = None,
    timeout: float | None = None,
) -> tuple[SummaryResult, TaxonomySuggestion | None, int, str | None]:
    """One combined request for summary + taxonomy (fewer calls, lower latency)."""
    prompt = build_enrichment_prompt(
        title=title,
        description=description,
        url=url,
        text=text,
        content_hint=content_hint,
    )
    try:
        result = await _guard(provider.complete(prompt, ENRICHMENT_SCHEMA, system=ENRICHMENT_SYSTEM), timeout)
    except TimeoutError:
        logger.warning("combined enrichment LLM call timed out after %ss", timeout)
        return SummaryResult(summary=None), None, 0, None
    except ProviderError as exc:
        logger.warning("combined enrichment LLM call failed: %s", exc)
        return SummaryResult(summary=None), None, 0, None

    raw_summary = result.data.get("summary")
    if isinstance(raw_summary, str) and raw_summary.strip():
        summary = SummaryResult(
            summary=clamp_summary(raw_summary),
            tokens_used=result.tokens_used,
            model=result.model,
            used_llm=True,
        )
    else:
        summary = SummaryResult(summary=None, tokens_used=result.tokens_used, model=result.model, used_llm=True)

    return summary, _taxonomy_from_data(result.data), result.tokens_used, result.model


def extract_first_paragraph(text: str, *, limit: int = 60) -> str | None:
    """Extractive fallback when no summary can be produced."""
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    if not cleaned:
        return None
    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    return clamp_summary(" ".join(sentences[:2]), limit=limit)
