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
  "source": "rightmove|zoopla",
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
