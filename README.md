# LifeStage Curator

A focused MVP for finding practical, community-curated guidance during major life transitions.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## MVP decisions

The first slice is intentionally local-first and dependency-light. It includes the six launch stages, seeded editorial resources, static sample article pages at `/articles/[id]`, personalized My Path preferences, search and filters, saved resources, a rich text article composer with preview mode, a community submission form, a development login at `/login`, profile privacy messaging, and a protected moderator queue view. Saved items, stage preferences, and the demo session persist in browser `localStorage`.

The following are explicit integration boundaries, not simulated production behavior: managed authentication and Google/Apple login, PostgreSQL persistence for authored content, URL metadata/oEmbed fetching, reputation calculations, duplicate detection, moderation persistence, analytics, email, and PWA/offline sync. The composer and demo login demonstrate formatting and review handoff locally; replace the demo session with a managed auth provider and server actions/API routes for production.

### Development admin access

Open `/login` and use the displayed sample moderator account:

- Email: `admin@lifestage.test`
- Password: `Curate2026!`

The account unlocks the Admin dashboard for local demonstration only.

## Product clarifications made

- MVP content is review-first: submissions are never published directly.
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
