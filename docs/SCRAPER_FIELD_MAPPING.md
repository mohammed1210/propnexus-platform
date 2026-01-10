# Scraper Field Mapping Documentation

## Overview
This document maps the data flow from property scraper sources (Rightmove, Zoopla, OnTheMarket, SpareRoom) through the database schema to AI scoring inputs.

## Data Flow Architecture

```
Scraper Sources → Normalized Format → Database (properties table) → AI Scoring/Analysis
```

## Scraper Source Fields

### Rightmove Scraper
**File**: `backend/scraper/rightmove_scraper.py`

| Scraper Field | Type | Description | Example |
|--------------|------|-------------|---------|
| property_id | string | Rightmove property ID | "123456789" |
| title | string | Property headline | "2 Bedroom Flat in London" |
| price | number | Asking price in GBP | 350000 |
| bedrooms | integer | Number of bedrooms | 2 |
| bathrooms | integer | Number of bathrooms | 1 |
| property_type | string | Type of property | "Flat", "House", "Bungalow" |
| location_text | string | Area/locality | "Ealing, London" |
| postcode | string | Property postcode | "W5 1AA" |
| description | string | Full property description | "Modern two bed..." |
| image_url | string | Primary image URL | "https://..." |
| image_urls | array[string] | All property images | ["https://...", ...] |
| latitude | number | GPS latitude | 51.5074 |
| longitude | number | GPS longitude | -0.1278 |
| url | string | Property listing URL | "https://rightmove.co.uk/..." |

### Zoopla Scraper
**File**: `backend/scraper/zoopla_scraper.py`

| Scraper Field | Type | Description | Example |
|--------------|------|-------------|---------|
| listing_id | string | Zoopla listing ID | "98765432" |
| title | string | Property headline | "3 Bed House" |
| price | number | Asking price | 450000 |
| num_bedrooms | integer | Bedroom count | 3 |
| num_bathrooms | integer | Bathroom count | 2 |
| property_type | string | Property type | "Detached house" |
| location | string | Location string | "Birmingham" |
| postcode | string | Postcode | "B15 2TT" |
| description | string | Description | "Spacious family home..." |
| image_url | string | Primary image | "https://..." |
| photos | array[string] | All images | ["https://...", ...] |
| latitude | number | GPS lat | 52.4862 |
| longitude | number | GPS lng | -1.8904 |

### OnTheMarket Scraper
**File**: `backend/scraper/onthemarket_scraper.py`

Similar structure to Rightmove/Zoopla with slight field name variations that are normalized in the output.

### SpareRoom Scraper
**File**: `backend/scraper/spare_room_scraper.py`

Focused on room rentals with similar core fields plus additional fields like:
- room_type
- available_from
- min_term
- max_term

## Normalized Scraper Output Format

All scrapers output a normalized format before insertion into the database:

```python
{
    "external_id": str,        # Source-specific ID
    "title": str,              # Property title
    "description": str,        # Full description
    "location": str,           # Human-readable location
    "price": float,            # Price in GBP
    "bedrooms": int,           # Bedroom count
    "bathrooms": int,          # Bathroom count
    "property_type": str,      # Property type
    "image_url": str,          # Primary image URL
    "image_urls": list[str],   # All images
    "latitude": float,         # GPS latitude
    "longitude": float,        # GPS longitude
    "source": str,             # "rightmove", "zoopla", "onthemarket", "spareroom"
    "raw_url": str,            # Original listing URL
    "postcode": str,           # Optional postcode
}
```

## Database Schema (properties table)

**Migration**: `supabase/migrations/2025-11-13-align-properties-schema.sql`

| Column Name | Type | Nullable | Description | Source Field |
|------------|------|----------|-------------|--------------|
| id | uuid | NOT NULL | Primary key | Auto-generated |
| external_id | text | NULL | Source-specific ID | external_id |
| title | text | NULL | Property title | title |
| description | text | NULL | Full description | description |
| price | numeric | NULL | Price in GBP | price |
| bedrooms | integer | NULL | Bedroom count | bedrooms |
| bathrooms | integer | NULL | Bathroom count | bathrooms |
| property_type | text | NULL | Property type | property_type |
| address | text | NULL | Full address | *(rarely available)* |
| postcode | text | NULL | Postcode | postcode or location |
| latitude | numeric | NULL | GPS latitude | latitude |
| longitude | numeric | NULL | GPS longitude | longitude |
| source | text | NULL | Source name | source |
| url | text | NULL | Listing URL | raw_url |
| image_urls | text[] | NULL | Image URLs array | image_urls |
| data | jsonb | NULL | Additional raw data | *(for future fields)* |
| created_at | timestamp | NULL | Record creation time | Auto-generated |
| updated_at | timestamp | NULL | Last update time | Auto-generated |
| user_id | uuid | NULL | User who saved it | *(for saved properties)* |
| saved_at | timestamp | NULL | When user saved | *(for saved properties)* |

### Key Indexes
- `idx_properties_postcode` - Fast lookup by postcode
- `idx_properties_source` - Fast lookup by source
- Unique constraint on `(source, external_id)` - Prevents duplicates

## AI Scoring & Analysis Inputs

### Investment Summary Generation
**Endpoint**: `POST /ai/summary`  
**File**: `backend/routes/ai.py`

| AI Input Field | Source | Description |
|---------------|--------|-------------|
| title | DB: title | Property title for context |
| location | DB: postcode or address | Location for market analysis |
| price | DB: price | Purchase price for calculations |
| yield_ | Calculated | Rental yield percentage |
| roi | Calculated | Return on investment percentage |
| description | DB: description | Property details for assessment |

**Calculation Sources** (from frontend or backend):
- `yield_percent` = (annual_rent / price) * 100
- `roi_percent` = (annual_profit / initial_investment) * 100

### Exit Strategy Generation
**Endpoint**: `POST /ai/strategies`

| AI Input Field | Source | Description |
|---------------|--------|-------------|
| title | DB: title | Property identifier |
| location | DB: postcode/address | Market context |
| price | DB: price | Current/purchase price |
| yield_ | Calculated | Current yield |
| roi | Calculated | Current ROI |
| property_type | DB: property_type | Property category |
| bedrooms | DB: bedrooms | Size indicator |
| description | DB: description | Property characteristics |

### Property Scoring (Frontend)
**Component**: Various property cards and detail pages

| Display Field | Source | Usage |
|--------------|--------|-------|
| Investment Score | Calculated | Overall investment rating (0-100) |
| Yield | Calculated | Expected rental yield % |
| ROI | Calculated | Expected return on investment % |
| Price per sqft | Calculated | Price efficiency metric |
| Location Score | DB: latitude/longitude + external API | Area desirability |
| Market Trend | External API + DB: price | Price movement analysis |

## Data Quality & Validation

### Required Fields for AI Scoring
Minimum fields needed for meaningful AI analysis:
1. **title** - Property identifier
2. **location** or **postcode** - Market context
3. **price** - Essential for calculations
4. **bedrooms** - Property size indicator

### Optional but Recommended
- **description** - Improves AI summary quality
- **property_type** - Better categorization
- **bathrooms** - More accurate valuation
- **latitude/longitude** - Location-based features
- **image_urls** - Visual context (not used in current AI but valuable)

### Data Cleaning Process
**Function**: `clean_property_data()` in `backend/scraper/utils.py`

Transformations applied:
- Normalize whitespace in text fields
- Convert empty strings to None
- Ensure numeric types for price, lat, lng
- Ensure integer types for bedrooms, bathrooms
- Validate URL formats
- Remove duplicate images from image_urls array

## Historical Data & Sold Prices

**Note**: Sold price history is not currently scraped but planned for future enhancement.

### Planned Enhancement
Future field additions for historical analysis:
- `sold_price` - Last sold price
- `sold_date` - Date of last sale
- `price_history` - Array of historical prices
- `days_on_market` - Listing duration

This data would enhance AI scoring by:
- Calculating price trends
- Identifying undervalued properties
- Estimating time to sell
- Predicting price appreciation

## EPC (Energy Performance Certificate) Data

**Current Status**: Not captured in standard scraping flow.

### Planned Integration
EPC data to be added in future:
- `epc_rating` - Current rating (A-G)
- `epc_score` - Numeric score (0-100)
- `potential_rating` - Potential rating after improvements
- `environmental_impact` - CO2 emissions rating

**Data Source**: UK Government EPC API  
**Usage in AI**: Factor into sustainability score and running costs

## Property Comparables (Comps)

**Endpoint**: `POST /comps/search`  
**Purpose**: Find similar properties for valuation

### Search Criteria
- Location (radius from lat/lng)
- Price range (±20% of target)
- Bedrooms (±1 of target)
- Property type (exact or similar)

### Data Used
All fields from properties table, with emphasis on:
- price (for valuation)
- bedrooms (for comparison)
- property_type (for similarity)
- latitude/longitude (for location matching)

## Image Processing

### Current Implementation
- Images stored as URLs in `image_urls` array
- Primary image in `image_url` field
- No image analysis or ML currently applied

### Future Enhancements
- Image quality scoring
- Room type detection (kitchen, bedroom, etc.)
- Condition assessment from images
- Virtual staging potential

## Data Retention

### Scrape Runs Table
**Migration**: `supabase/migrations/20251115_add_scrape_runs.sql`

Tracks scraping sessions:
- `id` - Run ID
- `source` - Scraper source
- `location` - Target location
- `started_at` - Start time
- `completed_at` - End time
- `status` - success/failed
- `properties_found` - Count
- `errors` - Error log

## API Response Format

### Property Detail Response
```json
{
  "id": "uuid",
  "external_id": "123456",
  "title": "2 Bed Flat in London",
  "description": "Modern apartment...",
  "price": 350000,
  "bedrooms": 2,
  "bathrooms": 1,
  "property_type": "Flat",
  "postcode": "W5 1AA",
  "latitude": 51.5074,
  "longitude": -0.1278,
  "source": "rightmove",
  "url": "https://rightmove.co.uk/...",
  "image_urls": ["https://...", "https://..."],
  "yield_percent": 4.5,
  "roi_percent": 12.3,
  "investment_score": 78
}
```

## Summary: Critical Path for AI Scoring

```
1. Scraper extracts raw data from listing sites
   ↓
2. Normalized to standard format
   ↓
3. Validated and cleaned
   ↓
4. Inserted into properties table
   ↓
5. Retrieved by frontend/backend with additional calculations
   ↓
6. Enriched with:
   - Rental estimates (yield calculation)
   - Comparable properties
   - Market data
   ↓
7. Fed to AI endpoints for:
   - Investment summary
   - Exit strategies
   - Recommendations
```

### Essential Fields for AI Quality
**High Priority** (must have):
- title, location, price, bedrooms

**Medium Priority** (recommended):
- property_type, bathrooms, description

**Low Priority** (nice to have):
- images, exact address, additional metadata

---

**Last Updated**: 2026-01-09  
**Maintainer**: Development Team  
**Related Docs**:
- `docs/scrapers/config.md` - Scraper configuration
- `docs/SCRAPER_ENHANCEMENTS.md` - Enhancement history
- `docs/ai/` - AI model documentation
