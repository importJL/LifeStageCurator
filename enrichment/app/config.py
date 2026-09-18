"""Configuration for the enrichment service.

All values are sourced from environment variables (see ``.env.example``) so the
same code path runs in local development and production (uc1_specs.md 2.4/2.6).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(SERVICE_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Inference provider (AI router)
    ai_router_provider: str = "openrouter"
    ai_router_base_url: str = "https://openrouter.ai/api/v1"
    ai_router_api_key: str = ""
    ai_router_model: str = "anthropic/claude-3.5-sonnet"
    ai_router_app_url: str = "http://localhost:3000"
    ai_router_app_name: str = "LifeStage Curator"

    # Enrichment behaviour
    enrichment_timeout_seconds: float = 30.0
    ai_call_timeout_seconds: float = 12.0
    ai_max_retries: int = 4
    http_fetch_timeout_seconds: float = 10.0
    use_offline_labelling_default: bool = True
    max_content_chars: int = 20000

    # Duplicate detection
    duplicate_store_path: Path = Field(default=Path("data/enrichment.db"))
    duplicate_similarity_threshold: float = 0.9
    enable_embedding_duplicates: bool = False
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Caching and cost controls
    cache_ttl_seconds: int = 3600
    max_requests_per_minute: int = 30
    daily_token_budget: int = 200_000
    request_token_budget: int = 8_000

    # Observability
    log_level: str = "INFO"
    enrichment_log_path: Path = Field(default=Path("data/enrichment-log.jsonl"))

    def resolved(self, path: Path) -> Path:
        """Resolve a possibly-relative path against the service root."""
        return path if path.is_absolute() else (SERVICE_ROOT / path)


@lru_cache
def get_settings() -> Settings:
    return Settings()
