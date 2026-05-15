-- Extend off_market_deals with optional fields used by the new Off-Market UI
-- Safe to run multiple times due to IF NOT EXISTS

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'off_market_deals'
  ) THEN
    RAISE NOTICE 'Table public.off_market_deals does not exist; skipping migration.';
    RETURN;
  END IF;

  -- Core enrichments
  EXECUTE 'ALTER TABLE public.off_market_deals ADD COLUMN IF NOT EXISTS address text';
  EXECUTE 'ALTER TABLE public.off_market_deals ADD COLUMN IF NOT EXISTS postcode text';
  EXECUTE 'ALTER TABLE public.off_market_deals ADD COLUMN IF NOT EXISTS estimated_value numeric';
  EXECUTE 'ALTER TABLE public.off_market_deals ADD COLUMN IF NOT EXISTS refurb_cost numeric';
  EXECUTE 'ALTER TABLE public.off_market_deals ADD COLUMN IF NOT EXISTS rent_potential numeric';
  EXECUTE 'ALTER TABLE public.off_market_deals ADD COLUMN IF NOT EXISTS discount_percent numeric';
  EXECUTE 'ALTER TABLE public.off_market_deals ADD COLUMN IF NOT EXISTS investment_score integer';
  EXECUTE 'ALTER TABLE public.off_market_deals ADD COLUMN IF NOT EXISTS agent_name text';
  EXECUTE 'ALTER TABLE public.off_market_deals ADD COLUMN IF NOT EXISTS agent_phone text';
  EXECUTE 'ALTER TABLE public.off_market_deals ADD COLUMN IF NOT EXISTS status text';
  -- Compatibility with spark naming (not used by UI, but harmless if present)
  EXECUTE 'ALTER TABLE public.off_market_deals ADD COLUMN IF NOT EXISTS imageurl text';
END $$;
