# Launch Blockers Tracker (P0)

Last updated: 2026-03-27

## Task status

- [ ] #370 Prevent frontend API base fallback to production backend
  - Link: https://github.com/mohammed1210/propnexus-platform/issues/370
  - Status: Complete on main (pending issue closure)
  - Notes: frontend/lib/api.ts now uses env-only base, localhost in non-production, and /api fallback in production.

- [ ] #371 Normalize Supabase env key handling across backend modules
  - Link: https://github.com/mohammed1210/propnexus-platform/issues/371
  - Status: Not started
  - Notes: Standardize env resolution and keep compatibility aliases only where intentional.

- [ ] #372 Ensure Yield/ROI proxy metrics render consistently in frontend
  - Link: https://github.com/mohammed1210/propnexus-platform/issues/372
  - Status: In progress
  - Notes: First fix in PR #373 (PDF export now derives canonical proxy metrics); continue UI surface audit.

## Completion checklist

A blocker can be marked complete only when all are true:

- [ ] Code changes merged to main
- [ ] Focused tests added/updated
- [ ] Related CI checks green
- [ ] Issue closed with evidence comment
