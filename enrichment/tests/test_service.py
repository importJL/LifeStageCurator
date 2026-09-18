from __future__ import annotations

import pytest

from app import service as service_module
from app.metadata import FetchedMetadata
from app.models import EnrichmentStatus, EnrichRequest
from app.service import EnrichmentService


@pytest.fixture
def hermetic(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(service_module, "sanitize_url", lambda url: url)


async def test_enrich_raw_text_only(service: EnrichmentService):
    request = EnrichRequest(raw_text="Breastfeeding and newborn sleep guidance for new parents.")
    response = await service.enrich(request)
    assert response.status in {EnrichmentStatus.success, EnrichmentStatus.partial}
    assert response.summary
    assert response.taxonomy.primary_life_stage


async def test_enrich_url_path_and_cache(service: EnrichmentService, monkeypatch: pytest.MonkeyPatch, hermetic):
    async def fake_fetch(url, *, client=None, timeout=10.0, max_chars=20000):
        return (
            FetchedMetadata(
                url=url,
                canonical_url=url,
                title="The calm first-month plan",
                description="A gentle checklist for the first weeks.",
            ),
            "A gentle checklist covering rest, food and newborn sleep routines.",
        )

    monkeypatch.setattr(service_module, "fetch_metadata", fake_fetch)

    request = EnrichRequest(url="https://example.com/calm-first-month")
    first = await service.enrich(request)
    assert first.metadata.title == "The calm first-month plan"
    assert first.status in {EnrichmentStatus.success, EnrichmentStatus.partial}

    second = await service.enrich(EnrichRequest(url="https://example.com/calm-first-month"))
    assert second.enrichment_meta.cached is True


async def test_exact_duplicate_detected(service: EnrichmentService, monkeypatch: pytest.MonkeyPatch, hermetic):
    async def fake_fetch(url, *, client=None, timeout=10.0, max_chars=20000):
        return FetchedMetadata(url=url, canonical_url=url, title="Dup"), "content"

    monkeypatch.setattr(service_module, "fetch_metadata", fake_fetch)

    first = await service.enrich(EnrichRequest(url="https://example.com/dup"))
    assert first.status in {EnrichmentStatus.success, EnrichmentStatus.partial}

    service.cache.clear()
    second = await service.enrich(
        EnrichRequest(url="https://example.com/dup?utm_source=newsletter", existing_content_id="other")
    )
    reasons = {match.reason for match in second.duplicates}
    assert "exact_url" in reasons


async def test_invalid_url_returns_error(service: EnrichmentService):
    response = await service.enrich(EnrichRequest(url="ftp://example.com/file"))
    assert response.status == EnrichmentStatus.error
    assert response.errors
    assert response.errors[0].code == "invalid_url"


async def test_duplicate_detection_can_be_disabled(
    service: EnrichmentService,
    monkeypatch: pytest.MonkeyPatch,
    hermetic,
):
    async def fake_fetch(url, *, client=None, timeout=10.0, max_chars=20000):
        return FetchedMetadata(url=url, canonical_url=url, title="No dedupe"), "text"

    monkeypatch.setattr(service_module, "fetch_metadata", fake_fetch)

    request = EnrichRequest(url="https://example.com/nodedupe", options={"detect_duplicates": False})
    response = await service.enrich(request)
    assert response.duplicates == []
    assert service.store.find_exact("https://example.com/nodedupe") is None
