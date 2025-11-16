# Scraper Configuration (Python + Proxy Providers)

## Modes

`SCRAPER_MODE` controls the first fetch attempt:
- `direct` (default): try the site with a realistic `User-Agent`. If blocked (403/503 or captcha keywords), automatically falls back to proxy (ScraperAPI) when `SCRAPERAPI_KEY` is set.
- `scraperapi`: use ScraperAPI from the start; if that fails the request is skipped.

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `SCRAPER_MODE` | `direct` or `scraperapi` | `direct` |
| `SCRAPERAPI_KEY` | API key for ScraperAPI fallback | (empty) |
| `RM_MAX_PAGES` | Max Rightmove pages (24 listings per page) | `1` |
| `RM_DELAY_MS` | Delay between Rightmove page fetches (ms) | `800` |
| `ZP_MAX_PAGES` | Max Zoopla pages | `1` |
| `ZP_DELAY_MS` | Delay between Zoopla pages (ms) | `900` |
| `OT_MAX_PAGES` | Max OnTheMarket pages | `1` |
| `OT_DELAY_MS` | Delay between OnTheMarket pages (ms) | `900` |
| `SR_MAX_PAGES` | Max SpareRoom pages | `1` |
| `SR_DELAY_MS` | Delay between SpareRoom pages (ms) | `900` |

## Output Schema

Each scraper returns a list of dictionaries keyed for Supabase upsert:
```json
{
  "external_id": "provider-specific ID",
  "title": "string",
  "location": "string",
  "price": 325000,
  "bedrooms": 3,
  "bathrooms": 1,
  "image_url": "https://...",
  "latitude": 51.5033,
  "longitude": -0.1195,
  "source": "rightmove|zoopla|onthemarket|spareroom",
  "raw_url": "search URL used"
}
```

## Geocoding

Coordinates are appended via `get_lat_lng_from_postcode(location_text)`. If lookup fails, latitude/longitude default to `0.0`.

## Bot Wall Detection

A response is considered blocked when:
- HTTP status is `403` or `503`
- Body contains any of: `captcha`, `access denied`, `unusual traffic`

In `direct` mode and with a valid `SCRAPERAPI_KEY`, the scraper retries through ScraperAPI.

## Extending Providers

To add more proxy providers (ZenRows, ScrapingBee), replicate `_fetch_html` logic with additional conditionals and environment variables:
- `ZENROWS_API_KEY`
- `SCRAPINGBEE_KEY`
- A generic `SCRAPER_PROVIDER` selector (e.g., `zenrows|scraperapi|bee|direct`).

### OnTheMarket and SpareRoom Sources

The platform now includes scrapers for **OnTheMarket** and **SpareRoom**, following the same architecture as Rightmove and Zoopla:

- **OnTheMarket**: Scrapes property listings from `https://www.onthemarket.com/for-sale/property/{location}/?view=grid&page={page}`
  - Controlled by `OT_MAX_PAGES` and `OT_DELAY_MS` environment variables
  - Uses the same SCRAPER_MODE fallback logic (direct → ScraperAPI on 403/503 or captcha detection)
  - Returns properties with source="onthemarket"

- **SpareRoom**: Scrapes flatshare/room listings from `https://www.spareroom.co.uk/flatshare/?location={location}&page={page}`
  - Controlled by `SR_MAX_PAGES` and `SR_DELAY_MS` environment variables
  - Uses the same SCRAPER_MODE fallback logic
  - Returns properties with source="spareroom"

Both scrapers follow defensive parsing patterns with multiple selector attempts and gracefully handle markup changes that may result in zero results with logging warnings.

## Operational Status & Scheduling

Current automation (GitHub Actions):

- `scraper-go-live.yml` (cron: `35 6 * * *` + manual dispatch): Runs the multi-source import (`POST /import/all`) for a list of locations and fails if total count is 0.
- `scraper-monitor.yml` (cron: every 6 hours): Health check + single location sanity import (`Ilford`) and warns (does not fail) if zero results.

Runtime entry points:

- **Primary unified import**: `POST /import/all` (Rightmove, Zoopla, OnTheMarket, SpareRoom) — dedupes then optional Supabase upsert. **Use this endpoint for all new integrations.**
- Individual source endpoints: `POST /import/{provider}` for targeted fetches.
- ~~Legacy endpoint: `POST /scrape`~~ — **DEPRECATED**. This endpoint is maintained for backwards compatibility only and will be removed in a future version. Use `/import/all` instead.
- Scheduled job: `POST /admin/schedule/daily` triggers `daily_scrape()` and logs run to `scrape_runs` table.

Improvements completed:

1. ✅ The `daily_scrape()` job can now be triggered via admin endpoint with proper RunLog tracking.
2. ✅ Exponential backoff with jitter and configurable retry limits via environment variables.
3. ✅ RunLog persistent table (`scrape_runs`) to audit frequency, duration, result counts, error flags.
4. ✅ `/scrape` endpoint deprecated in favor of `/import/all`.

Still to implement:

1. No alerting/notifications (email/Slack) when counts unexpectedly drop for specific locations or sources.
2. Proxy/provider rotation limited to ScraperAPI fallback; optional providers (ZenRows, ScrapingBee) are documented but not added.
3. Location list hard-coded in Action input or stub; no dynamic discovery (e.g. popular searches or user favourites).
4. Digest email task `send_daily_digest()` is a placeholder only.

Recommended enhancements:

- Add a lightweight FastAPI route `POST /admin/schedule/daily` that internally calls `daily_scrape()` (guarded by admin token) so external cron (Railway, Render, Cloud Scheduler) can trigger it without GitHub runner overhead.
- Persist each run into a `scrape_runs` Supabase table with columns: `id`, `started_at`, `finished_at`, `locations`, `source_counts` (JSON), `total_count`, `status`, `error_summary`.
- Implement exponential backoff + per-source retry (1–2 retries) for transient network errors and provider HTTP 5xx responses.
- Introduce basic anomaly detection: compare today’s counts vs 7‑day median; if drop > X% send a Slack webhook notification and mark run status = `degraded`.
- Expand proxy selection with `SCRAPER_PROVIDER=direct|scraperapi|zenrows|bee` and provider-specific env keys.
- Replace the legacy `/scrape` route by reusing `/import/all` logic and/or removing it after confirming no clients depend on it.
- Flesh out `send_daily_digest()` to query newly inserted properties (e.g. last 24h) and send grouped summaries (by location / price band) via your existing email route.
- Add an Action or scheduled job to regenerate a weekly performance report (counts, success rates, mean latency) and upload as artifact.

Minimal scheduler example (Railway / cron):

```
curl -X POST "$API_BASE/admin/schedule/daily" \
  -H "x-api-key: $OFF_MARKET_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

Where the handler simply calls `daily_scrape()` and returns a structured summary.

Security / rate considerations:

- Keep per-site delays (`*_DELAY_MS`) tuned to avoid bans; consider random jitter ±20%.
- Limit `*_MAX_PAGES` for initial expansion; store historical deltas in Supabase for anomaly detection.
- When adding new providers, unify error taxonomy (e.g. `blocked`, `captcha`, `network_timeout`, `parse_error`).

Monitoring quick wins:

- Add simple Prometheus-style counters (or Supabase row insert) per source success/failure.
- Emit a structured log line per location/source: `SCRAPE location=London source=zoopla count=42 duration_ms=1234 blocked=false`.
- Leverage existing `scraper-monitor.yml` to also parse and surface the per-source counts (extend endpoint response if needed).

Housekeeping:

- Once `/import/all` is canonical, update client code & remove `/scrape` to reduce duplication.
- Keep docs in sync when new sources or providers are added.

