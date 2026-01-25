# Launch Readiness Checklist

Use this checklist before merging `launch-readiness` back into `main` and before each production deploy.

## 1) Code + CI
- [ ] All changes are on a non-main branch (e.g. `launch-readiness`)
- [ ] Backend tests: `pytest -q` is green
- [ ] Frontend tests (if used): `cd frontend && npm test` is green
- [ ] Playwright e2e (if used): `cd frontend && npx playwright test` is green

## 2) Critical Integrations

### Stripe
- [ ] `STRIPE_SECRET_KEY` configured (prod key in prod)
- [ ] `STRIPE_WEBHOOK_SECRET` configured (prod webhook secret in prod)
- [ ] Webhook endpoint returns `200` for valid events
- [ ] Verified at least one real event in Stripe dashboard after deploy

### Supabase
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured
- [ ] RLS policies and required tables exist
- [ ] Schema is up-to-date with `supabase/schema.sql` (or any migration process you use)

## 3) Scrapers

### Global scraper settings
- [ ] `SCRAPER_MODE` is set correctly in production (recommended: `scraperapi` or `smart`)
- [ ] `SCRAPERAPI_KEY` present in production if `SCRAPER_MODE` is `scraperapi`/`smart`
- [ ] `PLAYWRIGHT_ENABLE=false` in production unless explicitly needed

### Rightmove
- [ ] Rightmove import returns non-zero items for a known-good location (or logs explain why 0)
- [ ] Minimal ScraperAPI URL retry works when the "place not found" variant appears
- [ ] `backend/tests/test_rightmove_minimal_url_retry.py` passes

### Other sources
- [ ] Zoopla import works for a known location
- [ ] OnTheMarket import works for a known location
- [ ] SpareRoom import works for a known location

## 4) Admin + Debug Endpoints
- [ ] `IMPORT_ADMIN_TOKEN` configured (recommended in prod)
- [ ] Import endpoints require `x-admin-token` when `IMPORT_ADMIN_TOKEN` is set
- [ ] Debug scrape probe endpoint is protected in production

### Quick curl checks (local or deployed)

Set a base URL first:

```bash
export BASE_URL="http://localhost:8000"
# or your Railway URL
```

Then hit the key routes:

```bash
# Health
curl -sS "$BASE_URL/health"

# Imports (token required only if IMPORT_ADMIN_TOKEN is set)

# Expect 401 when IMPORT_ADMIN_TOKEN is set and header is missing:
curl -i -sS -X POST "$BASE_URL/import/rightmove" -H 'content-type: application/json' \
	-d '{"location":"London"}'

curl -sS -X POST "$BASE_URL/import/rightmove" -H 'content-type: application/json' \
	-H "x-admin-token: $IMPORT_ADMIN_TOKEN" \
	-d '{"location":"London"}'

curl -sS -X POST "$BASE_URL/import/zoopla" -H 'content-type: application/json' \
	-H "x-admin-token: $IMPORT_ADMIN_TOKEN" \
	-d '{"location":"London"}'

curl -sS -X POST "$BASE_URL/import/onthemarket" -H 'content-type: application/json' \
	-H "x-admin-token: $IMPORT_ADMIN_TOKEN" \
	-d '{"location":"London"}'

curl -sS -X POST "$BASE_URL/import/spareroom" -H 'content-type: application/json' \
	-H "x-admin-token: $IMPORT_ADMIN_TOKEN" \
	-d '{"location":"London"}'

# All-sources import
curl -sS -X POST "$BASE_URL/import/all?req=London" -H "x-admin-token: $IMPORT_ADMIN_TOKEN"

# Debug scrape probe (protected by IMPORT_ADMIN_TOKEN when configured)
curl -sS "$BASE_URL/debug/scrape-probe?location=London&sources=rightmove,zoopla" \
	-H "x-admin-token: $IMPORT_ADMIN_TOKEN"

# AI routes
curl -sS -X POST "$BASE_URL/ai/summary" -H 'content-type: application/json' \
	-d '{"title":"2 bed flat","location":"London","price":350000,"yield":5.2,"roi":9.1,"description":"Bright, close to station"}'

# GPT scoring routes
curl -sS -X POST "$BASE_URL/gpt/score" -H 'content-type: application/json' -d '{}'
```

## 5) Runtime Smoke Test
- [ ] Backend boots: `uvicorn backend.main:app` (or Railway) and `/health` returns `200`
- [ ] Frontend boots (Vercel) and auth flow works end-to-end
- [ ] Can import properties and see them in UI
- [ ] AI endpoints return expected JSON structure (or are disabled via flags)

### UI smoke steps (5-10 minutes)
- [ ] Create account / sign in
- [ ] Import properties (Rightmove + at least one other source)
- [ ] Open a listing detail page and confirm key fields render
- [ ] Trigger AI summary/strategies and confirm consistent responses (or a clean 503 when AI is not configured)

## 6) Stripe Webhook Verification (production)
- [ ] Confirm webhook endpoint URL in Stripe points to `$BASE_URL/stripe/webhook`
- [ ] From Stripe dashboard: send a test event (e.g. `checkout.session.completed`) and verify 2xx response
- [ ] Confirm at least one real event appears after a real checkout
- [ ] If failures occur: check Railway logs and Stripe “Webhook Attempts” error details

## 6) Observability
- [ ] Error reporting (Sentry) configured if enabled
- [ ] Key logs/metrics present for scraping/import failures (zero-results warnings, blocking detection)
