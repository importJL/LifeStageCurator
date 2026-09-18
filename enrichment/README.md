# Enrichment service

Python FastAPI service implementing Tier 1 intelligent content ingestion and
enrichment for LifeStage Curator (see `../uc1_specs.md`). It fetches public
metadata, generates a short summary, suggests life-stage taxonomy, detects
duplicates, and can label content without any LLM calls.

## Capabilities

- **Metadata fetch** — title, description, thumbnail, publish date, canonical URL,
  site name via `httpx` + BeautifulSoup, plus oEmbed for YouTube/Vimeo.
- **Summarisation** — LLM via an OpenRouter-compatible router, with an extractive
  fallback.
- **Taxonomy** — primary life stage, sub-topics, content type, estimated minutes.
  LLM structured output or an offline rules/keyword path (`use_llm=false`, budget
  exhausted, or provider failure).
- **Duplicate detection** — exact canonical-URL match, plus optional near-duplicate
  similarity when embeddings are enabled.
- **Controls** — URL response cache, in-process rate limiting, per-request and daily
  token budgets, and a JSONL enrichment log for cost/quality monitoring.

## Layout

```
app/main.py         FastAPI app: POST /api/v1/content/enrich, GET /healthz
app/service.py      enrichment orchestration
app/metadata.py     URL sanitisation (SSRF guard), canonicalisation, HTML parsing
app/oembed.py       YouTube/Vimeo oEmbed
app/labelling.py    LLM + offline summary/taxonomy
app/duplicates.py   SQLite exact-URL index and embedding similarity
app/embeddings.py   optional sentence-transformers backend
app/providers/      InferenceProvider interface, OpenRouter + mock implementations
app/prompts.py      centralised prompt templates
app/config.py       pydantic-settings (all env vars)
```

## Run locally

From the repository root, `npm run dev:all` starts this service and the web app
together; `npm run dev:enrichment` starts the service alone. Or manually:

```bash
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cp .env.example .env          # then set AI_ROUTER_API_KEY (or AI_ROUTER_PROVIDER=mock)
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Verify the provider with `curl http://127.0.0.1:8000/healthz` — it reports
`provider`, `model`, and `llm_configured`. Summary and taxonomy are fetched in a
single combined LLM request; if the provider is slow or rate-limited
(`AI_CALL_TIMEOUT_SECONDS`, `AI_MAX_RETRIES`) the service falls back to offline
labelling and an extractive summary and reports `llm_fallback` rather than
failing.

`AI_ROUTER_PROVIDER=mock` runs the whole pipeline without any external calls —
useful for local development and tests.

The Next.js app calls this service through `app/api/enrich/route.ts`; set
`ENRICHMENT_SERVICE_URL` (default `http://127.0.0.1:8000`) in the frontend
environment.

## Optional ML extras

Near-duplicate embeddings require the optional extra:

```bash
.venv/bin/pip install -e ".[ml]"
```

Then set `ENABLE_EMBEDDING_DUPLICATES=true`. Without it, the service falls back
to exact-URL duplicate detection.

## Tests and lint

```bash
.venv/bin/python -m pytest
.venv/bin/ruff check .
```

## Example request

```bash
curl -X POST http://127.0.0.1:8000/api/v1/content/enrich \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com/article"}'
```
