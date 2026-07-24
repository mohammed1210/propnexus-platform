# Production Smoke Test: Sprint 2.1

- Initial smoke date/time: 2026-07-24 09:55:34 UTC
- Post-fix branch validation date/time: 2026-07-24 10:05:06 UTC
- Production URL tested: https://propnexus-platform.vercel.app
- Browser/device sizes used:
  - Chromium desktop: 1440x1600
  - Chromium mobile: 390x844
- Harness:
  - Playwright production config: [frontend/playwright.production.config.ts](/workspaces/propnexus-platform/frontend/playwright.production.config.ts)
  - Smoke spec: [frontend/e2e/production-smoke.spec.ts](/workspaces/propnexus-platform/frontend/e2e/production-smoke.spec.ts)
  - Command: `cd frontend && E2E_BASE_URL="https://propnexus-platform.vercel.app" npx playwright test -c playwright.production.config.ts e2e/production-smoke.spec.ts`

## Summary

The root cause of the Deal Pack/PDF production failure is now identified and fixed on branch `fix/sprint-2-production-deal-pack-smoke`:

- [frontend/lib/flags.ts](/workspaces/propnexus-platform/frontend/lib/flags.ts) defaulted `FF.DEAL_PACK` to `false` when the environment variable was unset.
- The live production deployment appears to have `NEXT_PUBLIC_FEATURE_DEAL_PACK` unset.
- That caused both server-side Deal Pack entrypoints to fail before canonical property lookup or entitlement gating:
  - [frontend/app/property/[id]/deal-pack/page.tsx](/workspaces/propnexus-platform/frontend/app/property/[id]/deal-pack/page.tsx)
  - [frontend/app/api/property-pdf/[id]/route.ts](/workspaces/propnexus-platform/frontend/app/api/property-pdf/[id]/route.ts)
- The working property page did not expose this because it loads client-side via [frontend/app/api/properties/[propertyId]/route.ts](/workspaces/propnexus-platform/frontend/app/api/properties/[propertyId]/route.ts), which is not gated by `FF.DEAL_PACK`.

Local validation on this branch is green, but the live production URL still shows the old `404` behavior because this branch has not been deployed yet.

The live Sprint 2.1 analyse experience is otherwise behaving correctly for anonymous production traffic:

- `/analyse` loads.
- mixed sale-price and rent text is parsed correctly.
- rent is not incorrectly copied into asking price.
- typed asking price is preserved on extract.
- Ask AI does not render on `/analyse` on desktop or mobile.
- pricing still shows the expected public plan lineup and amounts.

Two gaps remain at the production URL:

1. Anonymous creation of a deal from `/analyse` is blocked by sign-in, so submit-to-property redirect could not be completed without credentials.
2. For a public property linked from `/demo`, the direct Deal Pack route and PDF route do not match expected free-user gating behavior:
   - `/property/{id}/deal-pack` renders a not-found page instead of the Deal Pack preview.
   - `/api/property-pdf/{id}` returns `404 {"error":"not_found"}` instead of `403 upgrade_required`.

Because those route checks are still failing on the deployed production build, Sprint 2B should not start yet.

## Pass/Fail Table

| Step | Check | Result | Evidence | Notes |
| --- | --- | --- | --- | --- |
| 1 | Open production `/analyse` | PASS | Playwright run | Page loaded successfully on desktop and mobile. |
| 2 | Paste listing text containing asking price and monthly rent | PASS | [production-smoke-analyse-desktop.png](/workspaces/propnexus-platform/docs/screenshots/production-smoke-analyse-desktop.png) | Used provided smoke text. |
| 3 | Asking price parsed as purchase price | PASS | Playwright assertion | Blank asking price was populated to `250000`. |
| 4 | Monthly rent parsed as estimated monthly rent | PASS | Playwright assertion | Estimated monthly rent populated to `1400`. |
| 5 | Rent not parsed as asking price | PASS | Playwright assertion | Initial manual price `300000` was preserved during extract. |
| 6 | Existing typed fields are not overwritten | PASS | Playwright assertion | Manual asking price remained `300000` until cleared. |
| 7 | Submit the property | BLOCKED | Playwright observed post-submit auth blocker | Anonymous production session requires sign-in to create a deal. |
| 8 | Confirm redirect to `/property/{id}` | BLOCKED | Dependent on step 7 | Could not complete without authenticated test user. |
| 9 | Confirm generated property page loads | BLOCKED | Dependent on step 7 | Could not validate generated record path without credentials. |
| 10 | Source URL treated as user-provided reference only | PASS | Browser request log in Playwright | No browser request was made to `https://example.com/manual-smoke-test`. |
| 11 | No scraping/fetching happens | PASS | Browser request log in Playwright | No direct fetch/navigation to the supplied external source URL occurred. |
| 12 | Ask AI does not obstruct analyse form | PASS | [production-smoke-analyse-desktop.png](/workspaces/propnexus-platform/docs/screenshots/production-smoke-analyse-desktop.png), [production-smoke-analyse-mobile.png](/workspaces/propnexus-platform/docs/screenshots/production-smoke-analyse-mobile.png) | No Ask AI button rendered on `/analyse` on desktop or mobile. |
| 13 | Responsive checks: desktop and mobile | PASS | Desktop and mobile Playwright runs | Desktop passed; mobile test passed. |
| 14 | Direct Deal Pack route: Free user sees preview only | FAIL on live, FIXED in branch | [production-smoke-deal-pack-preview.png](/workspaces/propnexus-platform/docs/screenshots/production-smoke-deal-pack-preview.png) | Live production still renders not-found because the currently deployed build still has Deal Pack disabled by default. Branch fix enables launched default behavior. |
| 15 | PDF route: Free user receives upgrade/403 | FAIL on live, FIXED in branch | Playwright assertion and direct HTTP check | Live production still returns `404 {"error":"not_found"}` instead of `403 upgrade_required`. Branch fix restores server-side entitlement path once deployed. |
| 16 | Starter user: offer range visible, Deal Pack/PDF locked | BLOCKED | No Starter credentials available | Do not fake paid access. |
| 17 | Investor Pro user: full Deal Pack and PDF export | BLOCKED | No Investor Pro credentials available | Do not fake paid access. |
| 18 | `/pricing` shows expected public plans and amounts | PASS | [production-smoke-pricing.png](/workspaces/propnexus-platform/docs/screenshots/production-smoke-pricing.png) | Verified `Free £0`, `Investor Starter £9`, `Investor Pro £19`, `Sourcer Pro £39`, and `Coming soon`. |

## Screenshots

- [production-smoke-analyse-desktop.png](/workspaces/propnexus-platform/docs/screenshots/production-smoke-analyse-desktop.png)
- [production-smoke-analyse-mobile.png](/workspaces/propnexus-platform/docs/screenshots/production-smoke-analyse-mobile.png)
- [production-smoke-property-desktop.png](/workspaces/propnexus-platform/docs/screenshots/production-smoke-property-desktop.png)
- [production-smoke-deal-pack-preview.png](/workspaces/propnexus-platform/docs/screenshots/production-smoke-deal-pack-preview.png)
- [production-smoke-pricing.png](/workspaces/propnexus-platform/docs/screenshots/production-smoke-pricing.png)

## Live Findings

### 0. Root cause

- Normal property page endpoint:
  - browser calls `GET /api/properties/{id}` from [frontend/app/property/[id]/page.tsx](/workspaces/propnexus-platform/frontend/app/property/[id]/page.tsx)
- Deal Pack page endpoint:
  - server route calls `fetchPropertyById()` from [frontend/app/property/[id]/deal-pack/page.tsx](/workspaces/propnexus-platform/frontend/app/property/[id]/deal-pack/page.tsx)
- PDF route endpoint:
  - API route calls `fetchPropertyById()` from [frontend/app/api/property-pdf/[id]/route.ts](/workspaces/propnexus-platform/frontend/app/api/property-pdf/[id]/route.ts)
- Canonical backend property endpoint:
  - `GET /properties/{property_id}` in [backend/routes/properties_routes.py](/workspaces/propnexus-platform/backend/routes/properties_routes.py#L2376)
- Observed live behavior:
  - `GET /api/properties/57d1a817-17fa-461a-bde5-3bad8843e349` returns `200` with the property payload.
  - `GET /property/57d1a817-17fa-461a-bde5-3bad8843e349/deal-pack` renders the route-level not-found page.
  - `GET /api/property-pdf/57d1a817-17fa-461a-bde5-3bad8843e349` returns `404 {"error":"not_found"}`.
- Conclusion:
  - this was not a stale property ID, backend data absence, lookup mismatch, or internal-token problem.
  - it was the route-level `FF.DEAL_PACK` gate defaulting to off when unset in production.

### 1. Analyse parser and layout look correct in production

- Parser result matched expectations from the provided smoke text:
  - `price = 250000` when asking price field was blank
  - `estimatedMonthlyRent = 1400`
  - `bedrooms = 2`
  - `bathrooms = 1`
  - `postcode = UB7 7AA`
  - `propertyType = Flat`
- Manual asking price `300000` was not overwritten by extraction.
- No request was observed to the supplied external source URL, which supports the no-scraping/no-fetching requirement.
- Ask AI remained absent on `/analyse`, so it did not obstruct the quick import field, notes field, or submit button.

### 2. Anonymous create-deal flow needs credentials for end-to-end verification

- The live `/analyse` page now requires sign-in before a deal can be created.
- This prevented validation of:
  - successful submission
  - redirect to the newly created property page
  - generated-property source reference rendering for the newly created record

This is recorded as `BLOCKED`, not `FAIL`, because no authenticated smoke account was provided.

### 3. Free-user Deal Pack and PDF gating do not match expected behavior on a public property

Using a public property linked from `/demo`:

- Property ID used: `57d1a817-17fa-461a-bde5-3bad8843e349`
- Property API record exists and loads on the public property page.
- Direct Deal Pack route returned a not-found experience instead of the preview-only gated view.
- Direct PDF route returned `404` JSON instead of `403 upgrade_required`.

Direct HTTP evidence captured during smoke run:

- `GET /property/57d1a817-17fa-461a-bde5-3bad8843e349/deal-pack`
  - HTTP status: `200 text/html`
  - Rendered result in browser: not-found page, not preview-only gating
- `GET /api/property-pdf/57d1a817-17fa-461a-bde5-3bad8843e349`
  - HTTP status: `404 application/json`
  - Response body observed by Playwright: `{"error":"not_found"}`

That is the main production smoke failure from the current live deployment.

### 4. Fix prepared on this branch

- [frontend/lib/flags.ts](/workspaces/propnexus-platform/frontend/lib/flags.ts)
  - `DEAL_PACK` launch default changed from `false` to `true`
- Regression coverage updated:
  - [frontend/__tests__/lib/flags.spec.tsx](/workspaces/propnexus-platform/frontend/__tests__/lib/flags.spec.tsx)
  - [frontend/__tests__/property-page-flags.spec.tsx](/workspaces/propnexus-platform/frontend/__tests__/property-page-flags.spec.tsx)
  - [frontend/__tests__/property-deal-pack-page.spec.tsx](/workspaces/propnexus-platform/frontend/__tests__/property-deal-pack-page.spec.tsx)
  - [frontend/__tests__/api-property-pdf-route.spec.ts](/workspaces/propnexus-platform/frontend/__tests__/api-property-pdf-route.spec.ts)
- Smoke harness updated with anonymous and credential-gated authenticated modes:
  - [frontend/e2e/production-smoke.spec.ts](/workspaces/propnexus-platform/frontend/e2e/production-smoke.spec.ts)

Local validation for the fix branch:

- Targeted frontend tests: passed (`25` tests)
- Backend tests: passed with `PYTHONPATH=.. python -m pytest ../backend/tests/ -q`
- Full frontend Jest: passed (`69` suites, `316` tests)
- Frontend lint: passed
- Frontend production build: passed
- Live production smoke rerun: still failing on the deployed site until this branch is deployed

## Blockers

- No production test credentials were available for:
  - Free signed-in account
  - Investor Starter account
  - Investor Pro account
- Anonymous production users are sign-in gated on create-deal submit.
- Public-property Deal Pack/PDF route behavior did not match the expected free-user gating path.

## Recommended Test Accounts / Fixtures

To finish the blocked paid-plan checks safely without faking production access, add one of:

1. Production-safe smoke accounts exposed to Playwright only through environment variables:
  - `E2E_FREE_EMAIL`
  - `E2E_FREE_PASSWORD`
  - `E2E_STARTER_EMAIL`
  - `E2E_STARTER_PASSWORD`
  - `E2E_PRO_EMAIL`
  - `E2E_PRO_PASSWORD`
2. A staging-only entitlement fixture that can be exercised from a non-production environment.

Suggested setup steps for production-safe smoke users:

1. Create three Clerk users for Free, Investor Starter, and Investor Pro smoke coverage.
2. Ensure the backend user-plan record or source-of-truth plan mapping matches the intended plan for each user.
3. Do not reuse real customer accounts.
4. Store credentials only in local env or CI secrets, never in the repository.

## Sprint 2B Start Decision

Do not start Sprint 2B yet.

Reason:

- The live production smoke found a real route-level failure in the free-user Deal Pack/PDF path for a public property.
- The fix is ready locally but not yet deployed to the production URL tested here.
- Paid-plan checks are still incomplete because no smoke credentials were available.

## Scope Confirmation

- Sprint 2B was not started.
- Sprint 3 was not started.
- No pricing, Stripe, subscription, or entitlement logic was changed as part of this smoke pass.
- No pricing, Stripe, subscription, or entitlement rules were changed by the fix branch beyond enabling the already-launched Deal Pack feature by default when the env is unset.
- No scraping or URL fetching was added.
- Sprint 2B was not started.
- Sprint 3 was not started.
