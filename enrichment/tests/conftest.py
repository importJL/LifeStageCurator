from __future__ import annotations

from pathlib import Path

import pytest

from app.config import Settings, get_settings
from app.duplicates import DuplicateStore
from app.embeddings import EmbeddingBackend
from app.providers.mock import MockProvider
from app.service import EnrichmentService


def make_settings(tmp_path: Path, **overrides) -> Settings:
    values = {
        "ai_router_provider": "mock",
        "duplicate_store_path": tmp_path / "enrichment.db",
        "enrichment_log_path": tmp_path / "enrichment-log.jsonl",
        "enable_embedding_duplicates": False,
        "cache_ttl_seconds": 3600,
        "max_requests_per_minute": 1000,
    }
    values.update(overrides)
    return Settings(**values)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return make_settings(tmp_path)


@pytest.fixture
def store(settings: Settings) -> DuplicateStore:
    duplicate_store = DuplicateStore(settings.resolved(settings.duplicate_store_path))
    yield duplicate_store
    duplicate_store.close()


@pytest.fixture
def service(settings: Settings) -> EnrichmentService:
    instance = EnrichmentService(
        settings,
        provider=MockProvider(),
        embeddings=EmbeddingBackend(model_name="unused", enabled=False),
    )
    yield instance
    instance.store.close()


@pytest.fixture
def api_client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    from fastapi.testclient import TestClient

    monkeypatch.setenv("AI_ROUTER_PROVIDER", "mock")
    monkeypatch.setenv("DUPLICATE_STORE_PATH", str(tmp_path / "api.db"))
    monkeypatch.setenv("ENRICHMENT_LOG_PATH", str(tmp_path / "api-log.jsonl"))
    monkeypatch.setenv("MAX_REQUESTS_PER_MINUTE", "3")
    monkeypatch.setenv("ENABLE_EMBEDDING_DUPLICATES", "false")
    get_settings.cache_clear()

    from app.main import app

    with TestClient(app) as client:
        yield client
    get_settings.cache_clear()
