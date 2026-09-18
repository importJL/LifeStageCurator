"""Pydantic v2 request/response contracts for the enrichment endpoint.

The shapes follow uc1_specs.md 2.3 so suggestions can be mapped directly onto
the application's life-stage taxonomy.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EnrichmentStatus(StrEnum):
    success = "success"
    partial = "partial"
    error = "error"


class EnrichmentOptions(BaseModel):
    model_config = ConfigDict(extra="ignore")

    use_llm: bool = True
    use_offline_labelling: bool = True
    generate_summary: bool = True
    detect_duplicates: bool = True


class EnrichRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    url: str | None = None
    title_hint: str | None = None
    raw_text: str | None = None
    existing_content_id: str | None = None
    options: EnrichmentOptions = Field(default_factory=EnrichmentOptions)

    @model_validator(mode="after")
    def require_source(self) -> EnrichRequest:
        if not self.url and not (self.raw_text and self.raw_text.strip()):
            raise ValueError("either 'url' or non-empty 'raw_text' is required")
        return self


class ContentMetadata(BaseModel):
    title: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None
    published_at: str | None = None
    canonical_url: str | None = None
    site_name: str | None = None


class TaxonomySuggestion(BaseModel):
    primary_life_stage: str | None = None
    sub_topics: list[str] = Field(default_factory=list)
    content_type: Literal["article", "video", "podcast", "guide", "checklist", "tool", "unknown"] = "unknown"
    estimated_minutes: int | None = None


class DuplicateMatch(BaseModel):
    content_id: str
    similarity: float
    url: str | None = None
    reason: Literal["exact_url", "near_duplicate"] = "near_duplicate"


class EnrichmentError(BaseModel):
    code: str
    message: str
    field: str | None = None


class EnrichmentMeta(BaseModel):
    provider: str
    model: str | None = None
    latency_ms: int = 0
    tokens_used: int = 0
    offline_labelling_used: bool = False
    cached: bool = False
    llm_used: bool = False


class EnrichResponse(BaseModel):
    status: EnrichmentStatus
    metadata: ContentMetadata = Field(default_factory=ContentMetadata)
    summary: str | None = None
    taxonomy: TaxonomySuggestion = Field(default_factory=TaxonomySuggestion)
    duplicates: list[DuplicateMatch] = Field(default_factory=list)
    enrichment_meta: EnrichmentMeta
    errors: list[EnrichmentError] = Field(default_factory=list)
