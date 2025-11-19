# Scraper Enhancements - Implementation Summary

This document summarizes the enhancements made to the TypeScript and Python property scrapers for Rightmove and Zoopla.

## Overview

The scrapers have been enhanced with the following key features:
1. Property type field extraction and normalization
2. Image quality ranking and filtering
3. Optional detail page scraping for complete descriptions
4. Enhanced data structures with additional fields
5. **ScraperAPI integration** for production HTML scraping (Python backend)

## ScraperAPI Integration (Python Backend)

The Python Rightmove scraper now supports ScraperAPI for reliable HTML scraping in production environments.

### Configuration

Two environment variables control ScraperAPI usage:

- `SCRAPER_MODE`: Controls scraping behavior
  - `direct` (default): Fetch HTML directly from Rightmove
  - `scraperapi`: Use ScraperAPI proxy for all HTML fetches
  
- `SCRAPERAPI_KEY`: Your ScraperAPI API key (get from https://www.scraperapi.com/)

### Request Flow

The scraper uses a **JSON API first** approach with optional ScraperAPI for HTML fallback:

1. **JSON API** (always first):
   - Try Rightmove's JSON API endpoint (`/api/_search`)
   - If successful and sufficient results → return immediately
   - No ScraperAPI involvement at this stage

2. **HTML Fallback** (only if JSON API fails or returns no results):
   - **`SCRAPER_MODE=direct`** (default):
     - Fetch HTML directly from Rightmove
     - If blocked (403, captcha, etc.) → fallback to ScraperAPI (if key available)
   
   - **`SCRAPER_MODE=scraperapi`**:
     - Use ScraperAPI for all HTML fetches
     - Gracefully falls back to direct if SCRAPERAPI_KEY not set

### Example: Enable ScraperAPI in Production

```bash
# In your .env or environment variables
SCRAPER_MODE=scraperapi
SCRAPERAPI_KEY=your-actual-key-here
```

### Example: `/import/rightmove` Flow with ScraperAPI

```
1. POST /import/rightmove with location="London"
   ↓
2. scrape_rightmove_properties("London") called
   ↓
3. Try JSON API first (REGION^87490 for London)
   ↓
4. If JSON returns properties → validate, clean, return
   ↓
5. If JSON fails → HTML scraping begins
   ↓
6. With SCRAPER_MODE=scraperapi:
   - Build URL: https://api.scraperapi.com/?api_key=XXX&url=<rightmove-url>&country_code=gb&render=true&device_type=desktop
   - Fetch via ScraperAPI (with rendering)
   - Parse HTML cards
   ↓
7. Return normalized properties to import route
   ↓
8. Upsert to Supabase properties table
```

### Logging

The scraper logs ScraperAPI usage:

- `ℹ️ Using ScraperAPI for Rightmove HTML fetch: <url>` - When scraperapi mode is active
- `⚠️ SCRAPER_MODE=scraperapi but SCRAPERAPI_KEY not set, falling back to direct fetch` - Config warning
- `ℹ️ Fallback to ScraperAPI for blocked URL: <url>` - When direct fetch is blocked

### Implementation Details

**New Function: `make_scraperapi_url()`**

```python
def make_scraperapi_url(target_url: str, *, render: bool = False) -> str:
    """
    Build a ScraperAPI URL for the given target URL.
    Returns original URL if SCRAPERAPI_KEY not set.
    """
    # Builds: https://api.scraperapi.com/?api_key=XXX&url=<target>&country_code=gb
    # Adds &render=true&device_type=desktop when render=True
```

This mirrors the TypeScript implementation in `scripts/sources/rightmove.ts`.

## Changes by File

### TypeScript Scrapers

#### `scripts/sources/rightmove.ts`

**New Type Definition:**
```typescript
export type RMItem = {
  source: 'rightmove';
  source_id: string;
  title: string;
  location: string;
  price: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  property_type?: string | null;      // NEW
  description?: string | null;        // NEW
  imageurl?: string | null;
  image_urls?: string[];              // NEW
  latitude?: number | null;
  longitude?: number | null;
  detail_url?: string | null;         // NEW
};
```

**New Functions Added:**
- `extractImages()`: Extracts all images from a property card
- `parseSrcSet()`: Parses srcset attributes for high-res images
- `isPlaceholderImage()`: Filters out placeholder/blank images
- `rankImagesByQuality()`: Sorts images by resolution
- `extractImageSize()`: Extracts dimensions from image URLs
- `extractPropertyType()`: Extracts property type from card HTML
- `extractPropertyTypeFromText()`: Normalizes property type strings
- `scrapeDetailPage()`: Scrapes individual property detail pages (optional)

**Configuration:**
- `RM_SCRAPE_DETAILS=1`: Enable detail page scraping (default: 0)
- `RM_DEBUG=1`: Enable debug logging

#### `scripts/sources/zoopla.ts`

Similar enhancements as rightmove.ts with Zoopla-specific selectors.

**Configuration:**
- `ZP_SCRAPE_DETAILS=1`: Enable detail page scraping (default: 0)
- `ZP_DEBUG=1`: Enable debug logging
- `ZP_DELAY_MS=1200`: Delay between requests

### Python Scrapers

#### `backend/scraper/rightmove_scraper.py`

**New Functions Added:**
- `_extract_property_type(card)`: Extract property type from HTML card
- `_normalize_property_type(text)`: Normalize property type to standard values

**Changes to Existing Functions:**
- Updated `scrape_rightmove_properties()` to include property_type in results
- Updated `_fetch_api_properties()` to extract property_type from JSON API
- Added property_type tracking to scraper stats

**Property Types Supported:**
- flat (includes apartment)
- studio
- detached
- semi-detached
- terraced
- house
- bungalow
- maisonette
- cottage

#### `backend/scraper/zoopla_scraper.py`

Similar enhancements as rightmove_scraper.py with Zoopla-specific implementation.

### Tests

#### `backend/tests/test_scraper_improvements.py`

**New Test Function:**
```python
def test_property_type_extraction():
    """Test property type extraction and normalization."""
    # Tests 10 different property type cases including:
    # - "2 bedroom flat for sale" → "flat"
    # - "3 bed detached house" → "detached"
    # - "Semi-detached property" → "semi-detached"
    # - "Studio apartment" → "studio"
    # - etc.
```

## Property Type Normalization

The property type normalization follows this priority order:
1. **studio** - checked first to avoid matching "apartment"
2. flat/apartment
3. detached (excluding semi-detached)
4. semi-detached
5. terraced
6. bungalow
7. house
8. maisonette
9. cottage

Returns `None` if no match is found.

## Image Quality Ranking

The image ranking algorithm:
1. Extracts images from `src`, `data-src`, and `srcset` attributes
2. Filters out:
   - Placeholder images (containing "placeholder", "blank", "1x1", "pixel")
   - Small images (< 100px dimension detected from URL)
3. Extracts dimensions from URL patterns like `300x200` or `640x480`
4. Sorts by total pixel count (width × height)
5. Returns sorted array with highest quality first

## Detail Page Scraping

When enabled via environment variables:
- Fetches individual property detail pages
- Extracts complete descriptions (not just snippets)
- Collects additional images not shown in listing cards
- Merges data with listing card data
- Respects rate limiting with delays

**Trade-offs:**
- Increases API calls significantly (1 extra call per property)
- Takes more time to complete scraping
- Better for data quality, optional for speed

## Database Schema

The enhancements work with the existing schema defined in:
`supabase/migrations/2025-11-13-align-properties-schema.sql`

The `property_type` column was already present in the schema.

## Testing & Validation

- ✅ Python syntax check: All files compile without errors
- ✅ Property type tests: 10/10 test cases passing
- ✅ CodeQL security scan: 0 alerts found
- ✅ No breaking changes to existing functionality

## Usage Examples

### TypeScript Scraper (Basic)
```typescript
import { scrapeRightmove } from './scripts/sources/rightmove';

const searchUrl = 'https://www.rightmove.co.uk/property-for-sale/find.html?searchLocation=London';
const properties = await scrapeRightmove(searchUrl);

// Each property now includes:
// - property_type: 'flat' | 'house' | 'detached' | etc.
// - description: Full or partial description
// - image_urls: Array of all images, ranked by quality
// - detail_url: Link to property detail page
```

### TypeScript Scraper (With Detail Pages)
```bash
# Enable detail page scraping
export RM_SCRAPE_DETAILS=1
export RM_DEBUG=1

# Run scraper
tsx scripts/sources/rightmove.ts
```

### Python Scraper
```python
from backend.scraper.rightmove_scraper import scrape_rightmove_properties

properties = await scrape_rightmove_properties("London", limit=50)

# Each property includes property_type field
for prop in properties:
    print(f"{prop['title']} - {prop['property_type']}")
```

## Performance Considerations

### Without Detail Page Scraping (Default)
- Fast: ~1-2 seconds per page
- Captures: Basic property info + first image + card description
- Good for: Initial scraping, testing, high-volume scraping

### With Detail Page Scraping (Optional)
- Slower: ~5-10 seconds per property
- Captures: Complete descriptions + all images + enhanced metadata
- Good for: High-quality data, detailed analysis

## Migration Notes

No database migration required. The changes are backward compatible with existing data.

To populate property_type for existing records, run the scrapers again with the enhanced version.

## Future Improvements

Potential enhancements for future iterations:
1. Add property size/area extraction
2. Extract tenure information (leasehold/freehold)
3. Add energy rating extraction
4. Implement caching for detail pages
5. Add parallel processing for detail page fetching
6. Extract neighborhood/transport information

## Support

For issues or questions:
1. Check environment variables are set correctly
2. Enable DEBUG mode to see detailed logs
3. Review the .scrape_debug directory for HTML snapshots
4. Check stats output for missing field tracking
