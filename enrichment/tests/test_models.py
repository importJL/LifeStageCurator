from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models import EnrichmentMeta, EnrichmentStatus, EnrichRequest, EnrichResponse


def test_request_requires_url_or_raw_text():
    with pytest.raises(ValidationError):
        EnrichRequest()


def test_request_accepts_raw_text_only():
    request = EnrichRequest(raw_text="Some pasted guidance about newborn sleep.")
    assert request.options.use_llm is True


def test_request_defaults_options():
    request = EnrichRequest(url="https://example.com")
    assert request.options.generate_summary is True
    assert request.options.use_offline_labelling is True


def test_response_serialises_enum():
    response = EnrichResponse(
        status=EnrichmentStatus.partial,
        enrichment_meta=EnrichmentMeta(provider="mock"),
    )
    payload = response.model_dump(mode="json")
    assert payload["status"] == "partial"
    assert payload["duplicates"] == []
    assert payload["taxonomy"]["content_type"] == "unknown"
