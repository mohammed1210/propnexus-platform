# Scrapers (Python) – How to Run and Go‑Live Notes

The backend ships with four async scrapers and a unified ingestion flow:

- Rightmove – `backend/scraper/rightmove_scraper.py`
- Zoopla – `backend/scraper/zoopla_scraper.py`
- OnTheMarket – `backend/scraper/onthemarket_scraper.py`
- SpareRoom – `backend/scraper/spare_room_scraper.py`

Unification and normalization:

- `backend/utils/ingest.py` aggregates all sources, normalizes data to the `properties` schema
	(image_urls[], canonical `url`, address/postcode best‑effort) and dedupes.
- `backend/routes/import_routes.py` exposes POST `/import/all?req=London` (admin token protected) to trigger a scrape + upsert.

Continuous ingestion:

- `backend/tasks/ingestion_runner.py` runs a loop over configured locations and upserts results.
- `scripts/cron-ingest.sh` is a thin wrapper around `backend/scripts/cron-ingest.sh`, which calls the protected admin ingestion endpoint. A separate worker can also run `python -m backend.tasks.ingestion_runner` directly.

Environment (backend/.env or service config):

- Supabase
	- `SUPABASE_URL`
	- `SUPABASE_SERVICE_ROLE_KEY`
- Scrapers
	- `SCRAPER_MODE=direct|scraperapi`
	- Launch mode while ScraperAPI is off: `SCRAPER_MODE=direct`
	- Launch source allow-list: `INGEST_SOURCES=zoopla,onthemarket,spareroom`
	- Provider keys as available: `SCRAPERAPI_KEY` (optional)
	- Pagination/delay knobs: `RM_MAX_PAGES`, `ZP_MAX_PAGES`, `OT_MAX_PAGES`, `SR_MAX_PAGES`, and `*_DELAY_MS`
- Ingestion runner
	- `INGEST_LOCATIONS=London,Manchester,Liverpool,Birmingham`
	- `INGEST_INTERVAL_SECONDS=900` (15m)
	- `INGEST_SOURCES=zoopla,onthemarket,spareroom`
	- `INGEST_RUN_ONCE=0`
	- `INGEST_BATCH_SLEEP_MS=1500`

ScraperAPI-off soft-launch mode:

```bash
export SCRAPER_MODE=direct
export INGEST_SOURCES=zoopla,onthemarket,spareroom
export INGEST_INTERVAL_SECONDS=900
python -m backend.tasks.ingestion_runner
```

Rightmove is optional in this mode. Direct Rightmove scraping may return `0`, blocked, or degraded results; that should be logged as a degraded source, not treated as a worker crash. Full Rightmove reliability may require ScraperAPI later.

Local quick start (single cycle):

```bash
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export INGEST_RUN_ONCE=1
python -m backend.tasks.ingestion_runner
```

Production (Railway/Render) options:

- Railway uses `bash scripts/railway-start.sh` as the repo start command. It dispatches API services to `uvicorn backend.main:app` and the `vivacious-embrace` ingest-worker service to `python -m backend.tasks.ingestion_runner`.
- Keep the existing API service as HTTP/FastAPI.
- Run the worker as a long-running ingestion loop. Use `bash scripts/cron-ingest.sh` only for scheduled one-off calls into the API endpoint.
- Configure env vars per above on the worker
- Verify the worker in Railway/Render logs before claiming continuous ingestion is live. Expected startup lines include `[ingest-worker] starting`, `scraper_mode=direct`, `sources=zoopla,onthemarket,spareroom`, `scraperapi_configured=False`, and `supabase_configured=True`.

Railway ingest-worker required env:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or the service role env resolved by backend config)
- `SCRAPER_MODE=direct`
- `INGEST_SOURCES=zoopla,onthemarket,spareroom`
- `INGEST_LOCATIONS=London,Manchester,Liverpool,Birmingham` or the current launch target list
- `INGEST_INTERVAL_SECONDS=900` or another deliberate interval

`SCRAPERAPI_KEY` may be empty or omitted while `SCRAPER_MODE=direct`. Direct mode disables ScraperAPI fallback even if a stale key is present, unless `SCRAPERAPI_ALLOW_FALLBACK=true` is explicitly set. If a stale service env sets `SCRAPER_MODE=scraperapi` without a key, the worker logs a warning and coerces itself back to direct mode instead of exiting.

Worker health semantics while ScraperAPI is off:

- Healthy: process stays alive, exposes `/health` when Railway provides `PORT`, and completes scheduled direct-mode cycles.
- Degraded: one source is blocked, skipped, or returns 0 while the cycle continues.
- Failed: the service process exits or cannot start.

Verification:

- Call POST `/import/all?req=Liverpool` with header `x-admin-token: $IMPORT_ADMIN_TOKEN` and inspect `{ total_imported, sources, warning? }`
- Open the frontend `/listings` and confirm new rows appear
- Check container logs for per‑location counts

Notes & follow‑ups:

- Add data validation and monitoring (counts, blocking detection) post‑launch
- Consider provider rotation and quotas if `SCRAPERAPI_KEY` is switched back on
