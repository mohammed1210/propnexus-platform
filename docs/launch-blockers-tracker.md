# Launch Blockers Tracker (P0)

Last updated: 2026-04-01

## Task status

- [x] #370 Prevent frontend API base fallback to production backend
  - Link: https://github.com/mohammed1210/propnexus-platform/issues/370
  - Status: Complete on main
  - Notes: frontend/lib/api.ts now uses env-only base, localhost in non-production, and /api fallback in production.

- [x] #371 Normalize Supabase env key handling across backend modules
  - Link: https://github.com/mohammed1210/propnexus-platform/issues/371
  - Status: Complete on main
  - Notes: Alias handling shipped in PR #374 and the issue is already closed.

- [x] #372 Ensure Yield/ROI proxy metrics render consistently in frontend
  - Link: https://github.com/mohammed1210/propnexus-platform/issues/372
  - Status: Complete on main
  - Notes: Yield/ROI consistency shipped across PRs #373 and #375 and the issue is already closed.

- [x] #321 Add monitoring instrumentation for Stripe webhook route
  - Link: https://github.com/mohammed1210/propnexus-platform/issues/321
  - Status: Ready for merge
  - Notes: Backend /stripe/webhook is the monitored source of truth; the duplicate frontend webhook route is disabled.

- [x] #322 Map signed-in user to Stripe customer for portal session
  - Link: https://github.com/mohammed1210/propnexus-platform/issues/322
  - Status: Ready for merge
  - Notes: /api/stripe/portal resolves the signed-in user on the server, maps to users.stripe_customer_id via backend data, and returns users to /account.

## Completion checklist

A blocker can be marked complete only when all are true:

- [ ] Code changes merged to main
- [ ] Focused tests added/updated
- [ ] Related CI checks green
- [ ] Issue closed with evidence comment
