# Launch-ready checklist (no ScraperAPI / no live scraping)

This repo is intended to be launchable without ScraperAPI and without running any live scraping jobs.

## 0) Scope

Validated launch surface (no scraping):

- Listings browse + property detail pages
- Saved Deals (create/list/delete)
- DB-backed Insights: `/comps/{postcode}` and `/area-intel/{key}`
- AI endpoints are **gracefully disabled** (return `503` with `ai_disabled`) when `OPENAI_API_KEY` is missing
- Demo seed endpoint for a small set of sample properties

Not required for this launch mode:

- Live scraping / ingestion runs
- Scraper providers / ScraperAPI keys

## 1) Required env vars

Backend (FastAPI):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or equivalent service key)

For admin-protected endpoints (seed/demo, some debug/import routes):

- `ADMIN_TOKEN` (or `IMPORT_ADMIN_TOKEN`)

Frontend (Next.js):

- `NEXT_PUBLIC_BACKEND_URL`

Optional:

- `OPENAI_API_KEY` (only if you want AI enabled)

## 2) Backend verification

From repo root:

- Unit tests: `pytest -q`

Manual quick checks:

- `GET /health`
- `GET /properties?limit=1`
- `GET /gpt/health` (must return 200 even when AI is disabled)

## 3) Smoke scripts (recommended)

All scripts require an explicit `BASE_URL`.

### Seed demo data

- `BASE_URL=... ADMIN_TOKEN=... ./scripts/smoke_seed_demo.sh`

### DB insights

- `BASE_URL=... ./scripts/smoke_insights.sh`

### Saved Deals

- `BASE_URL=... CLERK_USER_ID=user_... ./scripts/smoke_saved_deals.sh`

## 4) AI disabled behavior (no key)

If `OPENAI_API_KEY` is not set:

- `GET /gpt/health` should report `ai_enabled: false`
- `POST /gpt/chat` should return `503` with `detail.ai_disabled: true`
- `POST /ai/summary` should return `503` with `detail.ai_disabled: true`

## 5) “No scraping” sanity

- Do not run `scripts/smoke_ingestion.sh` or any `run-ingestion`/`/import/*` flows for this launch mode.
- No ScraperAPI key should be required for the checks above.
