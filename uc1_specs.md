**Business & Technical Requirements**  
**Feature: Tier 1 – Intelligent Content Ingestion & Enrichment**  
LifeStage Curator

### 1. Business Requirements

**1.1 Goal**  
Reduce friction and improve consistency when users submit content by automatically enriching submissions with metadata, a concise summary, duplicate detection, and structured taxonomy suggestions (life stage, sub-topics, content type, estimated time-to-consume). The system must support both LLM-based inference (via AI router providers) and an offline/structured ML alternative for higher consistency and lower variable cost.

**1.2 Key User Stories**
- As a contributor, when I paste a URL I want the system to auto-fill title, description, thumbnail, publish date, and a short summary so I spend minimal time on data entry.
- As a contributor, I want the system to suggest the most relevant life stage(s), sub-topics, content type, and reading/watching time so taxonomy stays consistent.
- As a moderator, I want near-duplicate detection so the library does not fill with repeated items.
- As a product owner, I want the enrichment pipeline to work reliably in local development and production, with clear cost controls and fallbacks.

**1.3 Acceptance Criteria**
- Given a valid public URL, the system returns enriched metadata + summary + taxonomy suggestions within a reasonable timeout (target ≤ 15–20 s end-to-end for LLM path).
- Duplicate/near-duplicate detection flags exact URL matches and high-similarity content.
- Taxonomy suggestions are returned in a strict structured format (JSON) that can be directly mapped to the application’s life-stage taxonomy.
- The same enrichment service can be called from local development and from the hosted production application.
- An offline/ML path exists as an alternative or fallback that does not require external LLM calls for the structured labelling portion.
- Failures (network, rate limits, model errors) are handled gracefully with partial results or clear error states; the submission flow is never blocked permanently.
- All AI/ML usage is logged for cost monitoring and quality evaluation.

**1.4 Success Metrics**
- % of submissions that receive successful auto-enrichment.
- Average time saved per submission (qualitative + reduction in manual field edits).
- Duplicate detection precision/recall (measured against human review).
- Taxonomy suggestion acceptance rate by users/moderators.
- Cost per enrichment (LLM path) stays within defined budget.

**1.5 Constraints & Principles**
- Keep the implementation simple and low-impediment for AI coding agents.
- Prefer standard Python libraries and clear interfaces.
- Support pluggable inference backends (OpenRouter-style routers first).
- Prefer structured outputs over free-form text.
- Human remains in the loop for final approval; AI only suggests.
- Cost and latency must be controllable via configuration.

---

### 2. Technical Requirements

**2.1 High-Level Architecture**
- Python backend service (FastAPI recommended for clarity and speed of implementation).
- Single primary endpoint (or small set) that accepts a content submission payload and returns enrichment results.
- Inference layer abstracted behind a provider interface so OpenRouter (or compatible routers such as Opencode-style gateways) can be swapped or extended.
- Optional offline ML path for structured labelling (life stage, sub-topics, content type, time estimate).
- Configuration via environment variables for local vs production.
- Asynchronous or background-task friendly design so the main request can return quickly if desired (MVP can be synchronous with timeout).

**2.2 Core Capabilities to Implement**

| Capability | Description | Primary Method | Fallback / Alternative |
|------------|-------------|----------------|------------------------|
| Metadata fetch | Title, description, thumbnail/og:image, publish date, canonical URL, site name | HTTP fetch + HTML parsing (BeautifulSoup / readability-lxml or equivalent) + oEmbed where available | Partial metadata if fetch fails |
| Summarisation | Concise summary ≤ 200 words | LLM via AI router (structured prompt) | Extractive summary or first-paragraph fallback |
| Duplicate detection | Exact URL match + near-duplicate via embedding similarity | URL exact match in DB + embedding cosine similarity | Exact URL only |
| Topic labelling | Primary life stage, sub-topics, content type, estimated time-to-consume | LLM structured output **or** offline ML classifier / rules + embeddings | Offline ML path preferred for consistency |

**2.3 API Design (Python / FastAPI)**

**Endpoint**  
`POST /api/v1/content/enrich`

**Request body (example)**
```json
{
  "url": "https://example.com/article",
  "title_hint": "optional user-provided title",
  "raw_text": "optional pasted text if no URL",
  "existing_content_id": null,
  "options": {
    "use_llm": true,
    "use_offline_labelling": true,
    "generate_summary": true,
    "detect_duplicates": true
  }
}
```

**Response body (structured)**
```json
{
  "status": "success" | "partial" | "error",
  "metadata": {
    "title": "...",
    "description": "...",
    "thumbnail_url": "...",
    "published_at": "ISO-8601 or null",
    "canonical_url": "...",
    "site_name": "..."
  },
  "summary": "≤200 word summary",
  "taxonomy": {
    "primary_life_stage": "New Parents",
    "sub_topics": ["Sleep & Settling", "Parental Mental Health"],
    "content_type": "article",
    "estimated_minutes": 8
  },
  "duplicates": [
    {"content_id": "uuid", "similarity": 0.92, "url": "..."}
  ],
  "enrichment_meta": {
    "provider": "openrouter",
    "model": "anthropic/claude-3.5-sonnet",
    "latency_ms": 4200,
    "tokens_used": 1250,
    "offline_labelling_used": false
  },
  "errors": []
}
```

**2.4 Inference Integration (AI Router Providers)**

- Abstract provider interface, e.g. `InferenceProvider` with method `complete(prompt: str, response_schema: dict) -> dict`.
- Concrete implementation for OpenRouter (and compatible routers):
  - Base URL configurable (`https://openrouter.ai/api/v1` or equivalent).
  - Authentication via `Authorization: Bearer <API_KEY>`.
  - Model selectable via config (e.g. `OPENROUTER_MODEL`).
  - Support JSON mode / response_format where the provider allows it for structured taxonomy and summary.
- Local development: use the same code path with a development API key or a mock provider.
- Production: same code path, production keys and rate-limit handling.
- Critical design choice to minimise impediments:
  - Use `httpx` (async) or `requests` (sync) – keep it simple.
  - Centralise prompt templates in one module.
  - Enforce structured JSON output via prompt + provider JSON mode; validate with Pydantic.
  - Implement simple retry with exponential backoff for transient errors.
  - Hard timeout and token/cost guards.

**2.5 Offline / ML Alternative for Structured Labelling**
- Provide a parallel path that does **not** call an LLM for taxonomy decisions.
- Suggested lightweight approach (low impediment):
  - Pre-compute or use a small sentence-transformer model (or even TF-IDF + logistic regression / simple classifier) trained on labelled examples of life-stage content.
  - Input: title + summary/description + URL domain features.
  - Output: primary life stage, ranked sub-topics, content type, rough time estimate (rules + length heuristics).
- The offline path can run first or as fallback when `use_llm=false` or when LLM calls fail/budget is exceeded.
- Store model artefacts in the repository or load from a versioned path; keep dependencies minimal (scikit-learn + sentence-transformers only if necessary; pure rules + keyword matching acceptable for absolute MVP).

**2.6 Python Implementation Guidelines (for AI Coding Agents)**
- Language: Python 3.11+.
- Framework: FastAPI + Pydantic v2 for request/response models.
- HTTP client: `httpx` (preferred) or `requests`.
- HTML parsing: `beautifulsoup4` + `lxml` or `readability-lxml`.
- Embeddings for near-duplicate (optional but recommended): `sentence-transformers` or provider embeddings endpoint.
- Configuration: `pydantic-settings` or `python-dotenv` + environment variables.
- Key env vars:
  - `AI_ROUTER_BASE_URL`
  - `AI_ROUTER_API_KEY`
  - `AI_ROUTER_MODEL`
  - `ENRICHMENT_TIMEOUT_SECONDS`
  - `USE_OFFLINE_LABELLING_DEFAULT`
  - `EMBEDDING_MODEL` (if local)
- Logging: structured logs (request id, latency, tokens, provider, success/failure).
- Error handling: never raise unhandled exceptions to the caller; return `status: "partial"` or `"error"` with details.
- Idempotency: enrichment should be safe to retry.
- Testing: unit tests for metadata parser, Pydantic validation, provider mock, and offline labelling path.

**2.7 Data & Storage Considerations**
- Enrichment results may be cached by URL (short TTL) to avoid repeated LLM calls.
- Duplicate detection requires access to existing content embeddings or URL index (simple Postgres + pgvector or even in-memory for early stage).
- All suggestions are stored as “AI-suggested” so the UI can show provenance and allow easy override.

**2.8 Security, Cost & Operational Controls**
- API keys never committed; loaded from environment/secrets.
- Rate limiting on the enrichment endpoint.
- Per-request and daily cost/token budgets (simple counter or Redis).
- Input sanitisation on URLs (only http/https, block private IPs if possible).
- Clear separation between enrichment service and main application database writes.

**2.9 Implementation Phasing (Critical Path – Low Impediment)**
1. Metadata fetch + basic parsing (no AI).
2. OpenRouter (or compatible) client with structured prompt for summary + taxonomy.
3. Pydantic response models + FastAPI endpoint.
4. Exact URL duplicate check.
5. Offline labelling path (even if rule/keyword-based at first).
6. Near-duplicate embeddings (optional enhancement).
7. Caching, retries, cost guards, and observability.

This design keeps the surface area small, uses widely understood Python patterns, abstracts the inference provider so local and production behave the same, and offers a practical offline alternative for the most structured decisions. It is intentionally written so AI coding agents can implement it incrementally with clear contracts and minimal architectural debt.