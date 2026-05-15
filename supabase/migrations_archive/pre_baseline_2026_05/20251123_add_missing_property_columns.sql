-- Add missing columns to properties table
-- All columns use snake_case naming convention per database standards
-- Safe to run multiple times due to IF NOT EXISTS guards

BEGIN;

-- Investment analytics columns
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS yield_percent numeric;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS roi_percent numeric;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS investment_type text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS bmv numeric; -- Below Market Value

-- Additional fields for listings display
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS imageurl text;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_properties_investment_type ON public.properties(investment_type);
CREATE INDEX IF NOT EXISTS idx_properties_yield_percent ON public.properties(yield_percent);
CREATE INDEX IF NOT EXISTS idx_properties_roi_percent ON public.properties(roi_percent);
CREATE INDEX IF NOT EXISTS idx_properties_location ON public.properties(location);

-- Add helpful comments
COMMENT ON COLUMN public.properties.yield_percent IS 'Rental yield percentage';
COMMENT ON COLUMN public.properties.roi_percent IS 'Return on investment percentage';
COMMENT ON COLUMN public.properties.investment_type IS 'Investment strategy: HMO, BTL, SA, BRR, Flip, Commercial';
COMMENT ON COLUMN public.properties.bmv IS 'Below market value discount percentage';
COMMENT ON COLUMN public.properties.location IS 'Formatted location string for display';
COMMENT ON COLUMN public.properties.imageurl IS 'Primary image URL for property';

COMMIT;
