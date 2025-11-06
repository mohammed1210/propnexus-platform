-- Migration: Add unique index on properties table
-- Date: 2025-11-04
-- Purpose: Ensure property_id uniqueness for deduplication

-- Create unique index on property_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'properties' 
    AND indexname = 'idx_properties_property_id_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_properties_property_id_unique ON properties(property_id);
  END IF;
END $$;

-- Add additional helpful indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'properties' 
    AND indexname = 'idx_properties_location'
  ) THEN
    CREATE INDEX idx_properties_location ON properties(location);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'properties' 
    AND indexname = 'idx_properties_price'
  ) THEN
    CREATE INDEX idx_properties_price ON properties(price);
  END IF;
END $$;
