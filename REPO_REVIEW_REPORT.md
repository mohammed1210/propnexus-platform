# PropNexus Platform – Repo Review Report

Date: 2026-02-24

## 0) Snapshot (what was reviewed)

**Git**
- Branch: `main`
- HEAD: `879580ac233b4ae7767b252d9f5dfe0dfab0a5c1`
- Working tree: clean (review performed against `main` with no local-only edits)

**Recent commits (last 5)**
```text
879580ac (HEAD -> main, origin/main, origin/HEAD) Revert "Fix enrichment geo + cached metric overrides"
c1ed90ec Revert "Recompute score_breakdown after cached overrides"
429cadbb Revert "Fix Rightmove caret URLs + images; remove proxy rent and use DB medians for insights"
dbbfc197 Revert "data(cache): add 24h Supabase cache for /comps and /area-intel with tests and docs (#107)"
3aadb415 Revert "Fix admin ingestion body + signature-safe limit + smoke BASE_URL"
```

**Repo root listing (ls -la)**
```text
total 480
drwxrwxrwx+  23 codespace root        4096 Feb 24 18:23 .
drwxr-xrwx+   6 codespace root        4096 Jan 19 20:18 ..
-rw-rw-rw-    1 codespace codespace     43 Jan 19 20:34 .admin_token
-rw-rw-rw-    1 codespace root         142 Nov 21 15:03 .dockerignore
-rw-rw-rw-    1 codespace root        1321 Nov 20 21:50 .env.example
drwxrwxrwx+   9 codespace root        4096 Feb 24 18:27 .git
-rw-rw-rw-    1 codespace root          73 Nov 20 21:50 .gitattributes
drwxrwxrwx+   4 codespace root        4096 Nov 20 21:50 .github
-rw-rw-rw-    1 codespace codespace    694 Jan 21 19:58 .gitignore
-rw-rw-rw-    1 codespace root           3 Nov 20 21:50 .nvmrc
-rw-rw-rw-    1 codespace codespace    818 Jan 14 16:20 .pre-commit-config.yaml
-rw-rw-rw-    1 codespace root         106 Nov 20 21:50 .prettierrc
drwxr-xr-x+   3 codespace codespace   4096 Nov 21 14:23 .pytest_cache
-rw-rw-rw-    1 codespace codespace     62 Jan 14 16:20 .railwayignore
drwxrwxrwx+   3 codespace codespace   4096 Dec  4 12:48 .ruff_cache
drwxrwxrwx+   2 codespace root        4096 Nov 20 21:50 .scrape_debug
drwxrwxrwx+   5 codespace codespace   4096 Jan  9 11:45 .venv
-rw-rw-rw-    1 codespace root          64 Nov 20 21:50 .vercelignore
drwxrwxrwx+   2 codespace root        4096 Jan 14 16:20 .vscode
-rw-rw-rw-    1 codespace root        4264 Nov 20 21:50 CLERK_INTEGRATION_SUMMARY.md
-rw-rw-rw-    1 codespace codespace   3386 Jan 14 16:20 CONTRIBUTING.md
-rw-rw-rw-    1 codespace codespace   1049 Feb  9 13:55 Dockerfile
-rw-rw-rw-    1 codespace root        7411 Nov 20 21:50 IMPLEMENTATION_SUMMARY.md
-rw-rw-rw-    1 codespace codespace  10723 Jan 14 16:20 IMPLEMENTATION_SUMMARY_LISTINGS_SUBSCRIPTIONS.md
-rw-rw-rw-    1 codespace root        3267 Nov 20 21:50 PR_SUMMARY.md
-rw-rw-rw-    1 codespace root          58 Nov 21 15:03 Procfile
-rw-rw-rw-    1 codespace codespace   1990 Feb 13 13:04 README.md
-rw-rw-rw-    1 codespace codespace   7717 Jan 14 16:20 SPRINT-10-SUMMARY.md
-rw-rw-rw-    1 codespace codespace   7765 Jan 14 16:20 SPRINT-12A-SUMMARY.md
-rw-rw-rw-    1 codespace root         676 Nov 20 21:50 SPRINT10_SUMMARY.md
drwxrwxrwx+   3 codespace root        4096 Nov 20 21:50 app
-rwxrwxrwx    1 codespace codespace   3784 Jan 14 16:20 apply_all_ci_fixes.sh
drwxrwxrwx+  16 codespace root        4096 Feb 22 21:30 backend
drwxrwxrwx+   2 codespace root        4096 Nov 20 21:50 branding
drwxrwxrwx+   2 codespace root        4096 Nov 20 21:50 components
drwxrwxrwx+   2 codespace root        4096 Nov 20 21:50 data
drwxrwxrwx+   9 codespace root        4096 Feb 23 20:59 docs
-rw-rw-rw-    1 codespace codespace    320 Jan 14 16:20 fix-tests.patch
-rwxrwxrwx    1 codespace codespace   8814 Jan 14 16:20 fix_backend_ci.sh
-rw-rw-rw-    1 codespace codespace   1904 Jan 14 16:20 fix_backend_observability_ci.sh
drwxrwxrwx+  17 codespace root        4096 Feb 22 14:29 frontend
drwxrwxrwx+   2 codespace root        4096 Nov 20 21:50 lib
-rw-rw-rw-    1 codespace root        1654 Nov 20 21:50 main.py
-rwxrwxrwx    1 codespace root        4615 Nov 20 21:50 merge-offmarket.sh
-rw-rw-rw-    1 codespace root         262 Nov 20 21:50 next-env.d.ts
-rw-rw-rw-    1 codespace codespace 143126 Jan 14 16:20 package-lock.json
-rw-rw-rw-    1 codespace codespace   1866 Jan 14 16:20 package.json
-rw-rw-rw-    1 codespace codespace    506 Jan 14 16:20 pyproject.toml
-rw-rw-rw-    1 codespace codespace     82 Jan 14 16:20 pytest.ini
-rw-rw-rw-    1 codespace codespace    700 Feb  9 13:55 railway.toml
-rw-rw-rw-    1 codespace codespace   1055 Jan 14 16:20 requirements.txt
drwxrwxrwx+   4 codespace root        4096 Feb 23 13:08 scripts
drwxrwxrwx+   5 codespace root        4096 Jan 17 11:08 supabase
drwxrwxrwx+   2 codespace root        4096 Nov 20 21:50 test-results
drwxrwxrwx+   3 codespace codespace   4096 Jan 22 16:39 tests
drwxrwxrwx+   2 codespace root        4096 Jan 14 16:20 tools
-rw-rw-rw-    1 codespace root         295 Nov 20 21:50 tsconfig.json
-rw-rw-rw-    1 codespace root         339 Nov 20 21:50 vercel.json
-rw-rw-rw-    1 codespace codespace  68343 Jan 14 16:20 yarn.lock
```

## 1) TL;DR (executive summary)

- This is a monorepo: **FastAPI backend** (Supabase Postgres) + **Next.js frontend** (App Router), with **Clerk auth** and **Stripe billing**, plus optional **OpenAI** features.
- The backend is surprisingly defensive about schema drift and missing fields, especially in `GET /properties` and `GET /properties/{id}` (normalization + best-effort derived metrics).
- The frontend has a couple of high-risk “foot-guns” around **API base URL selection** and **Yield/ROI display rules** (several UIs only show Yield/ROI if top-level fields are present).
- CI exists and is reasonably comprehensive, but there are also “soft-pass” workflows that can hide failures.

## 2) Architecture map (how it fits together)

**Frontend (Next.js / TypeScript)**
- Next.js App Router pages under `frontend/app/*`
- Data fetching is mixed:
  - Some pages call the backend directly via `frontend/lib/api.ts` (`API_BASE`)
  - Some pages proxy via internal Next.js route handlers under `frontend/app/api/*`
- A `normalizeProperty` utility attempts to make backend payloads resilient to drift.

**Backend (FastAPI / Python)**
- Entrypoint: `backend/main.py`
- Routers registered:
  - `properties_routes` (`/properties`, `/properties/{id}` + admin helpers)
  - `area_intel_routes` (`/area-intel/{key}`)
  - `comps_routes` (`/comps/{postcode}`)
  - `gpt_routes` (`/gpt/*`)
  - `ai` (`/ai/*`)
  - `off_market_routes` (`/off-market/*`)
  - plus: scrape/import/enrich/stripe/users/waitlist/notes/debug/admin
- DB access: Supabase client (`supabase-py`) used directly in route modules and some utilities.
- Caching/enrichment: there is a Supabase-backed enrichment cache table pattern (`property_enrichment_cache`, `postcode_geo_cache`, etc.) with best-effort behavior if tables are missing.

## 3) Backend route contracts (key user-facing endpoints)

This is the minimal “launch surface” to verify end-to-end flows.

### Health & diagnostics
- `GET /health` → `{status:"ok", service:"propnexus-backend", version, environment}` and sets `X-PropNexus-Properties-Normalization: v1`
- `GET /debug/routes` → returns registered route paths/methods (useful for production verification)
- `GET /debug/supabase-env` → safe “env present” check (does not dump full secrets)
- `GET /debug/scraper-env` → safe scraper config check (no secrets)

### Core listings
- `GET /properties` → `{"items": [...], "total": n, "limit":, "offset":, "has_more":, "points"?: [...]}`
  - Sort supports: `recommended`, `created_at_desc`, `price_asc`, `price_desc`, `yield_desc`, `roi_desc`
  - Multiple deal-signal filters: `deals_only`, `auction_only`, `reduced_only`, etc.
  - Backend normalizes each row (`_normalize_property_row`) and attempts to backfill `price`, `rent_monthly`, `yield_percent`, `roi_percent` via `apply_canonical_metrics` + (if still missing) `compute_deal_score` inputs.
  - Optional: `include_points=1` returns a non-paginated “points” set (capped) for map pinning.
- `GET /properties/{property_id}` → normalized single property dict (best-effort attaches cached enrichment)

### Area intel & comps
- `GET /area-intel/{key}` → stable dict with area stats (currently stub provider implementation)
- `GET /comps/{postcode}` → `{source:"provider", postcode, sales:[...], rents:[...]}` (currently stub provider implementation)

### AI
Two stacks exist:
- `GET /gpt/health` (always 200) → `{ok:true, ai_enabled:bool, ai_disabled:bool}`
- `POST /gpt/chat` (requires `OPENAI_API_KEY`) → `{ok:true, reply, usage}`
- `POST /gpt/score` (deterministic, no GPT) → `{ok:true, score, categories, version}`
- `POST /gpt/score/explain` (requires `OPENAI_API_KEY`) → `{ok:true, explanation, bullets}`

And also:
- `POST /ai/summary`, `POST /ai/strategies`, `POST /ai/tradesmen/recommend` (requires `OPENAI_API_KEY`)

### Saved deals / notes / auth / billing
- Saved deals routes exist (Supabase-backed) and include compatibility logic for schema drift.
- Stripe routes exist under `/stripe/*` (checkout/portal + webhook handling).

## 4) Risks & bugs (ranked)

### P0 (launch blockers / high-risk)
1) **Frontend can default to production backend if env vars are missing**
   - `frontend/lib/api.ts` falls back to a production Railway URL when `NEXT_PUBLIC_BACKEND_URL`/`NEXT_PUBLIC_API_URL` are not set.
   - Risk: local dev, preview deploys, or misconfigured environments can silently hit prod.

2) **Supabase env var naming is inconsistent across backend modules**
   - Example: `backend/utils/supabase_client.py` checks `SUPABASE_KEY` / `SUPABASE_SERVICE_KEY`, while many route modules use `SUPABASE_SERVICE_ROLE_KEY`.
   - Risk: some routes/features think Supabase is “not configured” even when the service role key is present (and vice versa).

3) **Yield/ROI show as N/A in parts of the frontend even when proxy metrics exist**
   - Some UI elements only display Yield/ROI badges when the backend returns `yield_percent` / `roi_percent` as top-level fields.
   - Even though the frontend can derive proxy values (rent+price), those derived values are not consistently shown where users expect.

### P1 (should fix soon)
1) **Two different AI stacks (`/gpt/*` and `/ai/*`) with overlapping purpose**
   - Increases maintenance cost; unclear which is canonical.

2) **Multiple rate limiting systems**
   - SlowAPI global limiter + a custom in-memory limiter for AI endpoints.
   - Risk: inconsistent behavior in multi-instance deployments and hard-to-reason limits.

3) **Debug endpoints are enabled by default**
   - They are “safe-ish” but still provide environment presence signals.
   - Consider restricting by environment or admin token.

### P2 (cleanup / quality)
1) **Dead/duplicate route modules exist**
   - e.g. `backend/routes/health.py` defines `/health` but isn’t included by `backend/main.py`.

2) **CI includes soft-pass workflows**
   - `E2E Smoke` and `CI – Build` can “pass” even on failures.

## 5) Code health notes (what’s solid)

- Backend `GET /properties` is thoughtfully defensive:
  - Schema-cache mismatch handling (PostgREST APIError parsing)
  - Normalization and best-effort enrichment attachment
  - `include_points` avoids huge payloads by default
- Canonical metrics derivation (`backend/utils/canonical_metrics.py`) is explicit about rules:
  - no fabricated zeros
  - clear heuristics for percent parsing and ROI proxying

## 6) Top improvements (execution plan)

### P0 improvements (1–3 days each)
1) **Make backend URL selection safe by default**
   - Remove production fallback from the frontend, or guard it behind an explicit `NEXT_PUBLIC_ALLOW_PROD_FALLBACK=1`.
   - Verification: local dev without env must fail loudly with a clear error.

2) **Unify Supabase env var handling**
   - Centralize env parsing into one function and use it everywhere (`SUPABASE_SERVICE_ROLE_KEY` preferred).
   - Verification: a single “missing supabase config” message across all routes when misconfigured.

3) **Standardize Yield/ROI display behavior**
   - Decide canonical source order:
     1) backend top-level `yield_percent`/`roi_percent`
     2) backend `score_breakdown.inputs.*` (if present)
     3) frontend computed proxy (rent+price)
   - Verification: listings cards and property details show the same numbers.

### P1 improvements (3–5 days)
1) **Pick one AI surface** (`/gpt` vs `/ai`)
   - Deprecate the other or make one a thin wrapper.

2) **Make debug endpoints environment-gated**
   - Only enable in dev/staging or require admin token.

3) **Reduce “soft-pass” CI**
   - Keep non-blocking E2E if needed, but ensure failures are visible (annotations, separate required check, or nightly-only non-blocking).

## 7) Suggested next sprint plan (1–2 weeks)

A practical 10–15 task sprint, biased toward small, reviewable commits.

1) Unify backend Supabase env parsing (0.5d)
2) Add a backend `/config` or `/health` field that reports “supabase_configured” (safe boolean) (0.5d)
3) Remove/guard prod fallback in frontend `API_BASE` (0.5d)
4) Consolidate env var docs: pick canonical names and update `.env.example`, `backend/.env.example`, `frontend/.env.example` (1d)
5) Normalize Yield/ROI consistently in `frontend/lib/normalizeProperty.ts` (1d)
6) Update card/details UI to use the same normalized fields (1d)
7) Add a small contract test that asserts `GET /properties?limit=1` returns numeric `yield_percent` when `price` and `rent_monthly` are present (0.5d)
8) Add a `GET /debug/routes` sanity check in deploy runbook (0.25d)
9) Make debug endpoints require admin in production (1d)
10) Decide `/gpt` vs `/ai` canonical surface; add deprecation notes/docs (1d)
11) Tighten Next.js build settings: stop ignoring TS/ESLint errors (optional staged rollout) (1–2d)
12) CI: convert soft-pass E2E into “allowed to fail but visible” (1d)

## 8) Proposed small-commit breakdown (reviewable series)

1) Docs: env var canonicalization + run instructions cleanup
2) Backend: central Supabase env helper + update `get_supabase` callers
3) Frontend: remove production fallback for backend base URL
4) Frontend: yield/roi normalization fallback order (top-level → score_breakdown → proxy)
5) Frontend: update listing cards and property page to rely on normalization
6) CI: add/adjust a contract test for yield/roi presence
7) Ops: gate debug endpoints by environment/admin

## 9) Appendix: notable implementation details

- `GET /properties` sets a stable header: `X-PropNexus-Properties-Normalization: v1`.
- Properties normalization attaches cached enrichment when available and can optionally kick off background enrichment threads (`ENRICH_ON_READ_LIST`, `ENRICH_ON_READ_DETAIL`).
- Provider implementations for `/comps` and `/area-intel` are currently deterministic stubs (`backend/services/providers.py`), which is good for CI/stability but may not match production intent.
