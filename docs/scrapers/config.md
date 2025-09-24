# Scraper Provider Configuration

This project supports multiple scraping modes to fetch property search pages. Choose a provider by setting the `SCRAPER_MODE` environment variable:

- `direct` (default) – Fetch pages directly via `fetch`. May trigger bot walls.
- `scraperapi` – Proxy requests through [ScraperAPI](https://www.scraperapi.com/). Requires `SCRAPERAPI_KEY`.
- `nojs` – Use a simple HTTP request without JavaScript (for static pages).

## Environment variables

- `SCRAPER_MODE`: Selects the default provider (`direct` | `scraperapi` | `nojs`).
- `SCRAPERAPI_KEY`: API key for ScraperAPI (required for `scraperapi` mode or fallback).
- `SCRAPER_MAX_RETRIES`: Maximum attempts before giving up (default: `4`).
- `SCRAPER_BACKOFF_BASE_MS`: Base delay in milliseconds for exponential backoff (default: `500`).

## Bot wall detection

The provider detects bot walls when:

- HTTP status is 403 or 503 AND
- The HTML contains keywords like “robot”, “captcha”, “verify”, or “access denied”.

If a bot wall is detected in `direct` mode and `SCRAPERAPI_KEY` is set, the fetch automatically retries using `scraperapi`.

## Examples

```bash
# Use direct mode with default retries
SCRAPER_MODE=direct node scripts/ingest-live.ts "https://example.com/search?q=properties"

# Use scraperapi mode explicitly
SCRAPER_MODE=scraperapi SCRAPERAPI_KEY=your-key node scripts/ingest-live.ts "https://example.com/search"
