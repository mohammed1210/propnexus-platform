# PO Roadmap

This document outlines the scope and acceptance criteria for our phased development plan. The plan is divided into three phases: PO1 (Platform Hygiene & Scaffolding), PO2 (Feature Automation), and PO3 (Monetization, Alerts & Admin Ops).

## PO1 — Platform Hygiene & Agent Scaffolding

Focus on establishing a solid foundation for the repository.

**Scope**

- Create GitHub templates (issue, PR, CODEOWNERS).
- Implement CI pipelines for frontend and backend.
- Set up preview workflow for verifying deployments.
- Provide comprehensive developer documentation, contribution guidelines, ADRs, and release checklists.
- Add environment variable examples.
- Add a deployment verification script and baseline tests.

**Acceptance Criteria**

- CI runs and passes on pull requests and pushes to `main`.
- `scripts/verify-deploy.sh` returns 0 against a healthy deployment.
- Documentation covers setup for Vercel, Railway, Supabase, and environment variables.
- No existing code is modified; all additions are additive.

## PO2 — Feature Automation

Introduce core automation features and user‑facing AI integrations.

**Scope**

- Create FastAPI endpoints for AI summarisation and strategy generation.
- Extend backend with rate‑limiting utilities and off‑market routes.
- Provide tests for new endpoints.
- Add frontend components and API helpers to consume AI routes.
- Implement scraping provider abstraction and ingestion scripts with fallback strategies.
- Configure Supabase Row Level Security (RLS) policies and seed data.

**Acceptance Criteria**

- AI routes respond successfully with valid input.
- New components integrate seamlessly with existing UI.
- Ingestion scripts handle different providers gracefully and log structured output.
- RLS policies restrict row access to the owning user.
- All tests pass.

## PO3 — Monetization, Alerts & Admin Ops

Add billing, alerts, and user management features.

**Scope**

- Introduce Stripe-based billing endpoints and paywall logic.
- Create alert routes and a cron job to dispatch email notifications.
- Add administration interfaces for managing alerts.
- Provide pricing page and subscription management UI.
- Supply mailer utilities and email templates.
- Document Stripe setup, alert frequencies, and any security considerations.

**Acceptance Criteria**

- Users can create alerts and receive batched notifications.
- Paywall enforces subscription checks on protected routes.
- Stripe checkout and webhooks operate correctly without exposing PII.
- Cron jobs send emails according to user preferences.
- User interfaces are consistent with existing styling and accessibility standards.

These phases build on each other: PO1 lays the foundation, PO2 delivers core automation features, and PO3 introduces monetization and operational alerts.
