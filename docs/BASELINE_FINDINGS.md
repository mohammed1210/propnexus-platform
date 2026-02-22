# Baseline Findings (2026-02-22)

## Repo state
- Branch: `main`
- HEAD: `88c61450 scripts: update scrape runner to use import + probe`
- Working tree: clean (`git status --porcelain` empty)

## Backend
- `python -m compileall backend`: OK
- `pytest -q`: PASS (some tests skipped)
- Notes:
  - FastAPI `@app.on_event` deprecation warnings (startup/shutdown handlers)
  - Supabase client deprecation warnings (`timeout`, `verify`)
  - Occasional `PytestUnraisableExceptionWarning` about asyncio event loop closed

## Frontend (frontend/)
- `npm test`: PASS (15 suites / 82 tests)
- `npm run build`: PASS (Next.js 15.5.9)
- `npm run lint`: PASS
- Notes:
  - React console warnings about “outdated JSX transform” in tests
  - Next build runs with custom Babel config (`.babelrc`), so SWC is disabled

## API route list
- `BASE_URL` not set in this environment → skipped `curl $BASE_URL/openapi.json` route dump.
