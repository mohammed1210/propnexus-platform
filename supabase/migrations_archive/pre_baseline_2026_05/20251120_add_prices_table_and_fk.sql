-- Migration: Add prices table and establish FK to subscriptions.price_id
-- Date: 2025-11-20
-- Description:
--   Introduces public.prices to store Stripe price metadata.
--   Backfills rows from existing subscriptions.price_id values.
--   Adds foreign key constraint subscriptions.price_id -> prices.stripe_price_id.
--   Adds supporting index and comments. All operations are idempotent to allow re-runs.
--
-- Rollback Strategy (manual):
--   1. ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_price_id_fkey;
--   2. DROP INDEX IF EXISTS idx_subscriptions_price_id;
--   3. DROP TABLE IF EXISTS public.prices; (Only if no other objects depend.)
--
-- NOTE: If you have canonical Stripe price IDs (e.g. for PRO / INVESTOR), seed them explicitly
--       after running this migration with INSERT ... ON CONFLICT DO NOTHING.
--
-- Safe guards: Uses IF NOT EXISTS checks and DO blocks to avoid errors on repeated runs.

BEGIN;

-- 1. Create prices table (idempotent)
CREATE TABLE IF NOT EXISTS public.prices (
  stripe_price_id TEXT PRIMARY KEY,
  product_id TEXT,
  nickname TEXT,
  unit_amount INTEGER,       -- smallest currency unit (e.g. cents)
  currency TEXT,
  billing_interval TEXT,     -- e.g. month, year
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Backfill distinct subscription price_ids into prices (only those not already present)
INSERT INTO public.prices (stripe_price_id, nickname)
SELECT DISTINCT s.price_id, 'auto-imported'
FROM public.subscriptions s
WHERE s.price_id IS NOT NULL
  AND s.price_id <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.prices p WHERE p.stripe_price_id = s.price_id
  );

-- 3. Add FK constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass
      AND contype = 'f'
      AND conname = 'subscriptions_price_id_fkey'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_price_id_fkey
      FOREIGN KEY (price_id)
      REFERENCES public.prices (stripe_price_id)
      ON UPDATE CASCADE
      ON DELETE SET NULL; -- Preserve subscriptions if price removed
  END IF;
END$$;

-- 4. Index to speed joins/lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_price_id ON public.subscriptions(price_id);

-- 5. Comments
COMMENT ON TABLE public.prices IS 'Stripe prices referenced by subscriptions.price_id';
COMMENT ON COLUMN public.subscriptions.price_id IS 'FK to public.prices.stripe_price_id';

COMMIT;

-- Optional seed (uncomment and edit Stripe price IDs as needed):
-- INSERT INTO public.prices (stripe_price_id, nickname, unit_amount, currency, billing_interval)
-- VALUES
--   ('price_XXXX_PRO', 'PRO Plan', 2900, 'usd', 'month'),
--   ('price_XXXX_INVESTOR', 'INVESTOR Plan', 4900, 'usd', 'month')
-- ON CONFLICT (stripe_price_id) DO NOTHING;
