# Schema Update: Missing Properties Table Columns (2025-11-23)

## Summary

This update adds critical columns to the `properties` table that were being queried by the backend but missing from the schema, causing potential zero-data issues on the listings page.

## Problem

The backend's `properties_routes.py` was querying the following columns:

```python
SELECT_COLS = (
    "id,title,location,price,bedrooms,bathrooms,yield_percent,roi_percent,"
    "imageurl,latitude,longitude,created_at,description,investmentType"
)
```

However, the database schema was missing several of these columns:
- ❌ `investmentType` - Investment strategy type
- ❌ `yield_percent` - Investment yield percentage  
- ❌ `roi_percent` - Return on investment percentage
- ❌ `imageurl` - Single image URL (legacy)
- ❌ `location` - Property location text
- ❌ `bmv` - Below market value discount

This mismatch would cause queries to fail or return empty results, leading to the listings page showing 0 properties.

## Solution

Applied migration `20251123_add_missing_property_columns.sql` which:

### 1. Adds Missing Columns
```sql
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS yield_percent NUMERIC;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS roi_percent NUMERIC;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS bmv NUMERIC;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS imageurl TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS "investmentType" TEXT;
```

### 2. Adds Performance Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_properties_investment_type ON public.properties("investmentType");
CREATE INDEX IF NOT EXISTS idx_properties_yield ON public.properties(yield_percent);
CREATE INDEX IF NOT EXISTS idx_properties_roi ON public.properties(roi_percent);
CREATE INDEX IF NOT EXISTS idx_properties_location ON public.properties(location);
```

### 3. Updates Main Schema
The `supabase/schema.sql` file was updated to include these columns for new deployments.

## Field Naming Convention

Note the intentional field name transformation between backend and frontend:

| Backend (Supabase) | Frontend (TypeScript) | Reason |
|-------------------|----------------------|---------|
| `investmentType` (camelCase) | `investment_type` (snake_case) | Frontend prefers snake_case, mapping happens in listings/page.tsx |

## Investment Types

Supported investment strategy types:
- `HMO` - House in Multiple Occupation
- `BTL` - Buy to Let
- `SA` - Serviced Accommodation  
- `BRR` - Buy, Refurbish, Refinance
- `Flip` - Property flipping
- `Commercial` - Commercial property investment

## Migration Instructions

### For Existing Supabase Projects

1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of `migrations/20251123_add_missing_property_columns.sql`
3. Execute the SQL
4. Verify with:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'properties' AND table_schema = 'public'
ORDER BY ordinal_position;
```

### For New Supabase Projects

Simply run the complete `supabase/schema.sql` which now includes these columns.

## Testing

### Test Coverage
Added comprehensive test suite `frontend/__tests__/listings-schema-validation.spec.tsx`:
- 13 tests covering schema compatibility
- Backend-to-frontend field mapping validation
- Investment type filtering tests
- Zero-data scenario tests
- All tests passing ✅

### Manual Verification

Test the listings endpoint:
```bash
curl https://your-backend.railway.app/properties?limit=5
```

Expected response should include these fields:
```json
[
  {
    "id": "uuid",
    "title": "Property Title",
    "location": "City, Postcode",
    "price": 250000,
    "bedrooms": 3,
    "bathrooms": 2,
    "yield_percent": 5.5,
    "roi_percent": 12.0,
    "imageurl": "https://...",
    "investmentType": "BTL",
    ...
  }
]
```

## Impact

### Before
- Backend queries would fail on missing columns
- Listings page could show 0 properties even with data
- Investment type filtering wouldn't work
- Property cards would have missing information

### After
- ✅ All backend queries succeed
- ✅ Listings page displays all available properties
- ✅ Investment type filtering works correctly
- ✅ Property cards show complete information
- ✅ Performance optimized with indexes

## Related Documentation

- **Troubleshooting Guide:** `docs/LISTINGS_ZERO_DATA_TROUBLESHOOTING.md`
- **Schema Updates:** `supabase/SCHEMA_UPDATES.md`
- **Test Suite:** `frontend/__tests__/listings-schema-validation.spec.tsx`
- **API URL Resolution Tests:** `frontend/__tests__/lib/api-url-resolution.spec.tsx`

## Backward Compatibility

This migration is **backward compatible**:
- Uses `IF NOT EXISTS` to safely run multiple times
- Adds columns without modifying existing data
- No data loss or type changes
- Legacy scrapers continue to work with new schema

## Future Considerations

### Deprecation Path
Consider migrating from dual fields to single fields:
- `imageurl` (single, legacy) → `image_urls` (array, preferred)
- `location` (text, legacy) → `address` (text, preferred)

This would simplify the schema but requires updating scrapers and ingestion scripts.

### Investment Type Constraints
Consider adding a CHECK constraint to validate investment types:
```sql
ALTER TABLE public.properties 
  ADD CONSTRAINT properties_investment_type_check 
  CHECK ("investmentType" IN ('HMO', 'BTL', 'SA', 'BRR', 'Flip', 'Commercial'));
```

This would ensure data quality but requires coordinating with all data sources.

## Rollback (If Needed)

If you need to rollback this migration (not recommended):
```sql
BEGIN;
DROP INDEX IF EXISTS idx_properties_investment_type;
DROP INDEX IF EXISTS idx_properties_yield;
DROP INDEX IF EXISTS idx_properties_roi;
DROP INDEX IF EXISTS idx_properties_location;

ALTER TABLE public.properties DROP COLUMN IF EXISTS yield_percent;
ALTER TABLE public.properties DROP COLUMN IF EXISTS roi_percent;
ALTER TABLE public.properties DROP COLUMN IF EXISTS bmv;
ALTER TABLE public.properties DROP COLUMN IF EXISTS imageurl;
ALTER TABLE public.properties DROP COLUMN IF EXISTS location;
ALTER TABLE public.properties DROP COLUMN IF EXISTS "investmentType";
COMMIT;
```

**Warning:** This will cause the listings page to show 0 data again.
