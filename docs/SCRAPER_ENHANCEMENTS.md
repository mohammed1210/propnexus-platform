# Scraper Enhancements - Implementation Summary

This document summarizes the enhancements made to the TypeScript and Python property scrapers for Rightmove and Zoopla.

## Overview

The scrapers have been enhanced with the following key features:
1. Property type field extraction and normalization
2. Image quality ranking and filtering
3. Optional detail page scraping for complete descriptions
4. Enhanced data structures with additional fields

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
