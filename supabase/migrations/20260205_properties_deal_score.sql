-- Persisted deterministic deal scoring fields for public.properties.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.properties
  ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb;

CREATE INDEX IF NOT EXISTS properties_score_desc_idx
  ON public.properties (score DESC);

COMMENT ON COLUMN public.properties.score IS 'Deterministic deal score (0-100) computed server-side and stored';
COMMENT ON COLUMN public.properties.score_updated_at IS 'Timestamp when score was last computed';
COMMENT ON COLUMN public.properties.score_breakdown IS 'JSON breakdown for deterministic scoring';
