# Scraper Polish Checklist (PropNexus)

This checklist is grouped by outcome area and lists **exact files** to touch and **exact fixes** to apply. It is intentionally additive/safe.

## A) Reliability (timeouts, retries, rate limiting, blocked detection)

- [backend/scraper/utils.py](../backend/scraper/utils.py)
  - Add/standardize per-domain rate limiting + jittered delays for direct fetches.
  - Ensure retry applies **only** to transient failures (HTTP 429 + 5xx) with exponential backoff.
  - Centralize blocked/anti-bot detection helpers for shared use.

- [backend/scraper/rightmove_scraper.py](../backend/scraper/rightmove_scraper.py)
  - Treat 429/5xx as retryable; treat 403/captcha pages as blocked (no blind retries).
  - Add small per-domain jitter before detail-page enrichment requests.

- [backend/scraper/zoopla_scraper.py](../backend/scraper/zoopla_scraper.py)
  - Same retry rules (429/5xx only) + blocked detection for captcha/JS challenge pages.
  - Avoid false positives on Cloudflare beacon/analytics (keep current marker specificity).

- [backend/scraper/onthemarket_scraper.py](../backend/scraper/onthemarket_scraper.py)
  - Same retry rules (429/5xx only) + blocked detection for “Are you a robot?”/challenge pages.

- [backend/utils/retry.py](../backend/utils/retry.py)
  - Confirm retry helper supports: max attempts, base delay, jitter, and an allowlist of retryable status codes.

## B) Data Quality (full gallery, dedupe images, canonical cover image, unique listing keys)

- [backend/utils/image_utils.py](../backend/utils/image_utils.py) (new)
  - Add shared helpers:
    - Extract image arrays from `application/ld+json` (schema.org) blocks.
    - Extract/scan `__NEXT_DATA__` JSON for image URLs.
    - Dedupe by normalized URL (strip query/fragment) **and** by basename.
    - Choose canonical cover image (`imageurl`) preferring highest-res and avoiding floorplan/plan/epc.

- [backend/scraper/rightmove_scraper.py](../backend/scraper/rightmove_scraper.py)
  - Ensure `image_urls: string[]` contains full gallery (JSON-LD + embedded state + HTML).
  - Use shared dedupe + cover selection so `imageurl` is a best photo (not floorplan).

- [backend/scraper/zoopla_scraper.py](../backend/scraper/zoopla_scraper.py)
  - Ensure detail-page gallery extraction merges with card images.
  - Ensure `image_urls` is deduped and `imageurl` chosen consistently.

- [backend/scraper/onthemarket_scraper.py](../backend/scraper/onthemarket_scraper.py)
  - Ensure gallery extraction includes JSON-LD images and carousel images.
  - Ensure `image_urls` is deduped and `imageurl` avoids floorplan-only.

- [backend/routes/import_routes.py](../backend/routes/import_routes.py)
  - Enforce `image_urls` is always a list (default `[]`).
  - Apply shared image dedupe + cover selection during normalization.

- [backend/routes/properties_routes.py](../backend/routes/properties_routes.py)
  - Ensure API normalization returns `image_urls: []` (never null) and consistent `imageurl`.

## C) Geo (lat/lng extraction or postcode geocode fallback + caching)

- [backend/utils/postcode.py](../backend/utils/postcode.py)
  - Fix async/sync mismatch (currently `async` but uses blocking `requests`).
  - Add in-memory cache per run.
  - Add best-effort DB cache support (Supabase table if present) without failing if missing.
  - Add timeouts + retry for postcode lookups.

- [backend/scraper/rightmove_scraper.py](../backend/scraper/rightmove_scraper.py)
  - Ensure stored coords are numeric floats.
  - If missing coords: extract postcode from address/location and call postcode->lat/lng fallback.

- [backend/scraper/zoopla_scraper.py](../backend/scraper/zoopla_scraper.py)
  - Same postcode fallback behavior.

- [backend/scraper/onthemarket_scraper.py](../backend/scraper/onthemarket_scraper.py)
  - Same postcode fallback behavior.

- [backend/routes/properties_routes.py](../backend/routes/properties_routes.py)
  - Confirm frontend-compatible fields remain `latitude` / `longitude` (numbers or null).

## D) Ingestion (upsert strategy, dedupe rules, avoiding duplicate rows)

- [backend/routes/import_routes.py](../backend/routes/import_routes.py)
  - Create canonical unique key per listing:
    - Prefer `source + external_id` when present.
    - Else compute stable hash from normalized address + postcode + price + bedrooms.
  - Before upsert, drop null/empty fields so incomplete refreshes don’t clobber existing good data.
  - Ensure `updated_at`/`last_seen_at` always updates while preserving stable fields.

- [backend/utils/ingest.py](../backend/utils/ingest.py)
  - Keep external_id extraction rules consistent with API import pipeline.

## E) Observability (structured logs, per-run summary metrics, error sampling)

- [backend/utils/scraper_logger.py](../backend/utils/scraper_logger.py)
  - Ensure per-run summary emits: total cards, parsed ok, blocked count, retry count, avg images.

- [backend/utils/scrape_runs.py](../backend/utils/scrape_runs.py)
  - Ensure scrape_run is created/finished with counts + errors; add error sampling (first N errors).

- [backend/tasks/scrape_quality_report.py](../backend/tasks/scrape_quality_report.py)
  - Extend report to include: % with coords, avg images/listing, duplicates detected.
