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
	- Provider keys as available: `SCRAPERAPI_KEY` (optional)
	- Pagination/delay knobs: `RM_MAX_PAGES`, `ZP_MAX_PAGES`, `OT_MAX_PAGES`, `SR_MAX_PAGES`, and `*_DELAY_MS`
- Ingestion runner
	- `INGEST_LOCATIONS=London,Manchester,Liverpool,Birmingham`
	- `INGEST_INTERVAL_SECONDS=900` (15m)
	- `INGEST_RUN_ONCE=0`
	- `INGEST_BATCH_SLEEP_MS=1500`

Local quick start (single cycle):

```bash
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export INGEST_RUN_ONCE=1
python -m backend.tasks.ingestion_runner
```

Production (Railway/Render) options:

- Keep the existing API service (Procfile -> uvicorn)
- Add a scheduled/worker service with start command `bash scripts/cron-ingest.sh` when calling the API endpoint, or `python -m backend.tasks.ingestion_runner` for a long-running ingestion loop.
- Configure env vars per above on the worker
- Verify the worker in Railway/Render logs before claiming continuous ingestion is live.

Verification:

- Call POST `/import/all?req=Liverpool` with header `x-admin-token: $IMPORT_ADMIN_TOKEN` and inspect `{ total_imported, sources, warning? }`
- Open the frontend `/listings` and confirm new rows appear
- Check container logs for per‑location counts

Notes & follow‑ups:

- Add data validation and monitoring (counts, blocking detection) post‑launch
- Consider provider rotation and quotas if `SCRAPERAPI_KEY` is used
