# PO Roadmap (PO1 → PO3)

## PO1 — Platform Hygiene & Scaffolding
- GitHub templates, CODEOWNERS.
- CI for frontend/backend, preview verify script.
- Dev docs, ADR, release checklist.
- Env examples.

**Done:** merged to `main`.

## PO2 — Feature Automation
- FastAPI AI routes: `/ai/summary`, `/ai/strategies`.
- Frontend wiring for Investment Summary (text) + Exit Strategies.
- Scraper provider abstraction + backoff/fallback.
- Supabase RLS for `saved_deals` + seed.
- Docs for AI routes & scrapers.

## PO3 — Monetization, Alerts & Admin
- Stripe checkout + webhook activation.
- Alerts CRUD + cron email sender; mailer adapter.
- Paywall wrapper + pricing page.
- Docs for billing, alerts.

## PO3.5 — Launch Readiness
- Sentry, rate-limit, backups/restore drill, uptime checks.
- Legal pages (ToS/Privacy/Cookies).
