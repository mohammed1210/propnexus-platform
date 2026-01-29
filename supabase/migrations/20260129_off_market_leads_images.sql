-- Add multi-image support for public.off_market_leads.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.off_market_leads
  ADD COLUMN IF NOT EXISTS image_urls text[];
