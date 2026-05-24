# PropNexus Soft Launch Risk Register

Last updated: 2026-05-18

## Soft Launch Status

PropNexus is suitable for a controlled soft-launch readiness cycle only after CI, deployment, auth, billing and smoke checks are green. The product should be positioned as an information and due-diligence workflow tool, not as financial, investment, mortgage, legal or tax advice.

## Known Limitations

- Data coverage varies by listing source, postcode, cache state and enrichment availability.
- Some listing details may be stale, removed, incomplete or different from the original source.
- Scores, summaries, offer targets and discovery signals are indicative and evidence-limited.
- Railway direct integration statuses may exist outside app code; GitHub Actions remains the deployment source of truth.

## ScraperAPI Off / Direct Mode

ScraperAPI is intentionally off for launch cost control. Launch checks should assume direct mode, with Rightmove or other direct-source blocking treated as a known limitation unless it prevents the worker from starting. Do not require ScraperAPI for go/no-go.

## Data Accuracy Limitations

Property data may come from third-party listings, cached records, public datasets, scraped pages, user inputs or derived estimates. Users must verify source listings, legal packs, tenure, condition, finance assumptions, taxes, fees and availability before acting.

## Rent Evidence Limitations

Rent figures may be estimates unless clearly labelled as direct rental evidence. Achievable rent should be confirmed against current local lettings evidence and realistic void, management and maintenance assumptions.

## Comparable Sales Limitations

Comparable evidence is indicative. Similarity can vary materially by property type, size, tenure, condition, micro-location and sale date. Users should manually verify comparables before relying on them.

## AI Limitations

AI-generated summaries, strategy suggestions and chat responses may be incomplete or inaccurate. They are starting points for review, not recommendations or professional advice.

## Legal / Advice Disclaimer

PropNexus does not provide financial advice, investment advice, mortgage advice, legal advice or tax advice. Users remain responsible for their own due diligence and should obtain independent professional advice before making property, lending, tax or legal decisions.

## Auth / Payment Checks

- Clerk sign-in/sign-up and protected routes should be tested in production mode.
- Saved deals must be tested with two separate users to verify isolation.
- Stripe checkout and portal flows must use authenticated user context.
- Stripe webhooks must be verified on the backend route that owns webhook processing.
- No email-only billing portal/session flow should be enabled in production.

## Operational Checks Before Launch

- Backend `/health` remains public and minimal.
- Debug routes are disabled in production or return sanitized booleans only.
- `bash scripts/launch_audit.sh` should pass before launch; warnings require review, failures are blockers.
- Service role, Stripe secret and OpenAI keys must not appear in client bundles.
- Original listing links should be tested from listings, detail pages and saved deals.
- Ingest worker should be direct mode running or explicitly paused with that state recorded.

## Go / No-Go Checklist

Before soft launch:

- [ ] CI green
- [ ] Vercel deployed
- [ ] Railway backend health OK
- [ ] Ingest worker direct mode running or explicitly paused
- [ ] Supabase migration baseline confirmed
- [ ] Terms/Privacy/Disclaimer visible
- [ ] Stripe test/live mode intentionally configured
- [ ] Clerk/auth production keys configured if auth enabled
- [ ] Saved deals tested with two separate users
- [ ] Original listing links tested
- [ ] Top Deals page tested
- [ ] Property detail page tested
- [ ] No debug route leaks
- [ ] No service role key in frontend bundle
- [ ] `bash scripts/launch_audit.sh` passes
