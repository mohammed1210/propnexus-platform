-- Add missing columns to properties table that are queried by backend but not in schema
-- These columns are required for the listings page to display data correctly
-- Safe to run multiple times due to IF NOT EXISTS guards

BEGIN;

-- Investment calculation columns used by frontend listings page
ALTER TABLE IF EXISTS public.properties 
  ADD COLUMN IF NOT EXISTS yield_percent NUMERIC;

ALTER TABLE IF EXISTS public.properties 
  ADD COLUMN IF NOT EXISTS roi_percent NUMERIC;

ALTER TABLE IF EXISTS public.properties 
  ADD COLUMN IF NOT EXISTS bmv NUMERIC;

-- Legacy column name for single image (used by scrapers)
-- This is in addition to image_urls array for backward compatibility
ALTER TABLE IF EXISTS public.properties 
  ADD COLUMN IF NOT EXISTS imageurl TEXT;

-- Location is used by frontend but schema has 'address' instead
-- Keep both for backward compatibility with existing scrapers
ALTER TABLE IF EXISTS public.properties 
  ADD COLUMN IF NOT EXISTS location TEXT;

-- Investment type field (HMO, BTL, SA, BRR, Flip, Commercial)
-- Note: Using camelCase to match backend SELECT query expectation
ALTER TABLE IF EXISTS public.properties 
  ADD COLUMN IF NOT EXISTS "investmentType" TEXT;

-- Add indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_properties_investment_type 
  ON public.properties("investmentType");

CREATE INDEX IF NOT EXISTS idx_properties_yield 
  ON public.properties(yield_percent);

CREATE INDEX IF NOT EXISTS idx_properties_roi 
  ON public.properties(roi_percent);

CREATE INDEX IF NOT EXISTS idx_properties_location 
  ON public.properties(location);

-- Add comments for documentation
COMMENT ON COLUMN public.properties.yield_percent IS 'Investment yield percentage';
COMMENT ON COLUMN public.properties.roi_percent IS 'Return on investment percentage';
COMMENT ON COLUMN public.properties.bmv IS 'Below market value discount';
COMMENT ON COLUMN public.properties.imageurl IS 'Legacy single image URL (use image_urls array for new data)';
COMMENT ON COLUMN public.properties.location IS 'Property location (use address for new data)';
COMMENT ON COLUMN public.properties."investmentType" IS 'Investment strategy type: HMO, BTL, SA, BRR, Flip, Commercial';

COMMIT;

-- Note: After applying this migration, verify with:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'properties' AND table_schema = 'public'
-- ORDER BY ordinal_position;
