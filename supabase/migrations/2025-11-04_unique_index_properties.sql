-- supabase/migrations/2025-11-04_unique_index_properties.sql
-- Add unique index on properties to prevent duplicates

-- Create properties table if it doesn't exist (basic structure)
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT,
  address TEXT,
  postcode TEXT,
  price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on property_id to prevent duplicates (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_property_id_unique ON properties(property_id);

-- Create index on postcode for geographic searches (if not exists)
CREATE INDEX IF NOT EXISTS idx_properties_postcode ON properties(postcode);

-- Create index on price for filtering (if not exists)
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);

-- Add comment to document the unique constraint
COMMENT ON INDEX idx_properties_property_id_unique IS 'Ensures each property_id is unique to prevent duplicates';
