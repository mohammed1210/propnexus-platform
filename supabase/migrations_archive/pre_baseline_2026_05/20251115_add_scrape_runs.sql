-- Migration: Add scrape_runs table for logging scraper runs
-- Created: 2025-11-15

CREATE TABLE IF NOT EXISTS scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  provider TEXT NOT NULL,
  source TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  properties_imported INTEGER DEFAULT 0,
  error_summary TEXT,
  duration_ms INTEGER,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scrape_runs_provider ON scrape_runs(provider);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_location ON scrape_runs(location);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_status ON scrape_runs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_started_at ON scrape_runs(started_at DESC);

-- Add RLS policy to allow admin access
ALTER TABLE scrape_runs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY scrape_runs_service_policy ON scrape_runs
  FOR ALL
  TO service_role
  USING (true);

COMMENT ON TABLE scrape_runs IS 'Logs scraper execution runs with status and metrics';
COMMENT ON COLUMN scrape_runs.provider IS 'Scraper provider (e.g., rightmove, zoopla, onthemarket, spareroom)';
COMMENT ON COLUMN scrape_runs.source IS 'Optional source identifier or trigger context';
COMMENT ON COLUMN scrape_runs.location IS 'Location being scraped';
COMMENT ON COLUMN scrape_runs.status IS 'Run status: running, success, failure';
COMMENT ON COLUMN scrape_runs.properties_imported IS 'Number of properties successfully imported';
COMMENT ON COLUMN scrape_runs.error_summary IS 'Error message if run failed';
COMMENT ON COLUMN scrape_runs.duration_ms IS 'Run duration in milliseconds';
COMMENT ON COLUMN scrape_runs.meta IS 'Additional metadata as JSON';
