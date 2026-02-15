-- Free Data Go Live: enrichment job queue
-- Apply in Supabase SQL editor or via migration tooling.

CREATE TABLE IF NOT EXISTS public.enrichment_jobs (
  id BIGSERIAL PRIMARY KEY,
  property_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|processing|done|failed
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status
  ON public.enrichment_jobs (status);

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_run_after
  ON public.enrichment_jobs (run_after);
