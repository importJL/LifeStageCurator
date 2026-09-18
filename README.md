# LifeStage Curator

A focused MVP for finding practical, community-curated guidance during major life transitions.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Enrichment service (optional)

URL ingestion and enrichment (metadata, summary, life-stage taxonomy, duplicate
detection) is implemented as a Python FastAPI service in `enrichment/`. The
submit form calls it through `app/api/enrich/route.ts`; if the service is not
running, the form still works and you can fill fields in manually.

Run both servers together (one Ctrl-C stops both):

```bash
npm run dev:all
```

Or start the service on its own (`npm run dev:enrichment`); first-time setup:

```bash
cd enrichment
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cp .env.example .env   # then set AI_ROUTER_API_KEY / AI_ROUTER_MODEL
```

If the service is not running, the composer shows a clear message and stays
usable for manual entry (the API returns `enrichment_unavailable`, not a crash).

Set `ENRICHMENT_SERVICE_URL` in the frontend environment to point elsewhere
(default `http://127.0.0.1:8000`). Use `AI_ROUTER_PROVIDER=mock` to run without
an API key, or configure `AI_ROUTER_API_KEY`/`AI_ROUTER_MODEL` for a real
OpenRouter-compatible router. Check `GET /healthz` to confirm `provider`,
`model`, and `llm_configured`. See `enrichment/README.md` and `uc1_specs.md`.

## MVP decisions

The first slice is intentionally local-first and dependency-light. It includes the six launch stages, seeded editorial resources, static sample article pages at `/articles/[id]`, personalized My Path preferences, working search and filters on every library view, login-gated submission, saved resources, a rich text article composer with preview mode and URL enrichment, a development login at `/login`, profile privacy messaging, sign out, and a protected moderator queue view. Saved items, stage preferences, and the demo session persist in browser `localStorage`.

The following are explicit integration boundaries, not simulated production behavior: managed authentication and Google/Apple login, PostgreSQL persistence for authored content, reputation calculations, moderation persistence, analytics, email, and PWA/offline sync. The composer and demo login demonstrate formatting and review handoff locally; replace the demo session with a managed auth provider and server actions/API routes for production. URL metadata/oEmbed fetching and duplicate detection are implemented in the `enrichment/` service.

### Development accounts

Open `/login` and use either displayed account, or click **Create a demo account** to become an activated member immediately.

- Member: `member@lifestage.test` / `Belong2026!` — sign in to submit and save.
- Admin: `admin@lifestage.test` / `Curate2026!` — also unlocks the Admin dashboard.

Both are local demonstration accounts only.

## Access model (demo)

- **Logged out** — only Home and Explore are available. Resource cards render as
  containers: titles are not clickable, Save is disabled, and a "Sign in to read
  & save" hint appears. Saved, Submit, Profile, and Admin are hidden. Article
  routes (`/articles/*`) are blocked by `middleware.ts` and redirect to
  `/login?next=<article>`, so content is never served to logged-out visitors.
- **Logged in** — members can search, read, save, and submit content. The topbar
  shows the initials avatar with a **Sign out** icon button beside it; Profile
  also has a Sign out button. Signing out returns to Home and re-applies the
  logged-out restrictions.
- **Search** — the search field and stage/type filters apply on Home (within My
  Path), Explore (whole library), and Saved (your saved items). Searchable text
  covers title, summary, topic, source, and stage.

## Product clarifications made

- MVP content is review-first: submissions are never published directly.
- Submission is limited to activated, signed-in profiles.
- A resource has one primary stage and one topic in the first slice; multiple topics and collaborative collections can follow.
- Professional guidance is labeled as practical information, with the no-substitute-for-professional-advice disclaimer shown at submission and intended for resource detail pages.
- The Admin view is a workflow prototype. Role-based access and durable moderation actions belong to the auth/database integration.
- Monetization is intentionally excluded until retention and content quality signals are known.

## Suggested next implementation order

1. Define the PostgreSQL schema for users, resources, votes, saves, collections, flags, and review events.
2. Add managed authentication and server-backed user preferences.
3. Move the seeded resources and sample article content into reviewed database records.
4. Add server-side full-text search, URL canonicalization/duplicate detection, and moderation audit events.
5. Add analytics for time-to-first-useful-content, saves, ratings, approvals, and collection shares.
