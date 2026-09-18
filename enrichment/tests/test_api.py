from __future__ import annotations


def test_healthz(api_client):
    response = api_client.get("/healthz")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["provider"] == "mock"
    assert body["llm_configured"] is True
    assert body["model"]


def test_enrich_raw_text(api_client):
    response = api_client.post(
        "/api/v1/content/enrich",
        json={"raw_text": "Breastfeeding and newborn sleep guidance for new parents."},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"success", "partial"}
    assert body["summary"]
    assert body["taxonomy"]["primary_life_stage"]
    assert "x-request-id" in {key.lower() for key in response.headers}


def test_enrich_requires_source(api_client):
    response = api_client.post("/api/v1/content/enrich", json={})
    assert response.status_code == 422


def test_enrich_invalid_url(api_client):
    response = api_client.post("/api/v1/content/enrich", json={"url": "ftp://example.com/file"})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "error"
    assert body["errors"][0]["code"] == "invalid_url"


def test_rate_limit(api_client):
    payload = {"raw_text": "A short snippet about moving into a new home."}
    for _ in range(3):
        assert api_client.post("/api/v1/content/enrich", json=payload).status_code == 200
    limited = api_client.post("/api/v1/content/enrich", json=payload)
    assert limited.status_code == 429
    assert limited.json()["errors"][0]["code"] == "rate_limited"
