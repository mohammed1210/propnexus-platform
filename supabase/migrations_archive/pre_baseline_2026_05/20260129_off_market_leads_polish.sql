-- Add missing columns/indexes/triggers for public.off_market_leads.
-- Safe to run multiple times.

-- Ensure core timestamps
ALTER TABLE IF EXISTS public.off_market_leads
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Canonical deal fields
ALTER TABLE IF EXISTS public.off_market_leads
  ADD COLUMN IF NOT EXISTS asking_price numeric,
  ADD COLUMN IF NOT EXISTS property_type text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric,
  ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0;

-- Ensure image columns exist (some environments may have only one)
ALTER TABLE IF EXISTS public.off_market_leads
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS imageurl text;

-- Ensure source default
ALTER TABLE IF EXISTS public.off_market_leads
  ALTER COLUMN source SET DEFAULT 'manual';

-- Reuse shared updated_at trigger function if present; otherwise create it.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_off_market_leads ON public.off_market_leads;
CREATE TRIGGER set_updated_at_off_market_leads
  BEFORE UPDATE ON public.off_market_leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS off_market_leads_created_at_desc_idx
  ON public.off_market_leads (created_at DESC);

CREATE INDEX IF NOT EXISTS off_market_leads_location_idx
  ON public.off_market_leads (location);

CREATE INDEX IF NOT EXISTS off_market_leads_investment_type_idx
  ON public.off_market_leads (investment_type);

CREATE INDEX IF NOT EXISTS off_market_leads_score_desc_idx
  ON public.off_market_leads (score DESC);
