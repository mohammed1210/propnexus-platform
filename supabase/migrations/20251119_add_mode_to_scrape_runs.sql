-- Migration: Add mode column to scrape_runs table
-- Created: 2025-11-19
-- Purpose: Track scraper mode (direct, scraperapi, smart)

ALTER TABLE scrape_runs ADD COLUMN IF NOT EXISTS mode TEXT;

-- Create index for mode queries
CREATE INDEX IF NOT EXISTS idx_scrape_runs_mode ON scrape_runs(mode);

COMMENT ON COLUMN scrape_runs.mode IS 'Scraper mode: direct, scraperapi, or smart';
