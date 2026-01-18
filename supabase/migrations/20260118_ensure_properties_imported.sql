-- Migration: Ensure properties_imported column exists
-- Created: 2026-01-18
-- This is idempotent and safe to run multiple times

ALTER TABLE scrape_runs
  ADD COLUMN IF NOT EXISTS properties_imported INTEGER DEFAULT 0;

-- Reload PostgREST schema cache to ensure column is visible
NOTIFY pgrst, 'reload schema';
