-- Launch-safe Area Intel and Comps caches.
-- Providers return live/cached public data or clearly labelled derived/internal comps.

CREATE TABLE IF NOT EXISTS public.area_intel_cache (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  source TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_area_intel_cache_fetched_at
  ON public.area_intel_cache (fetched_at DESC);

CREATE TABLE IF NOT EXISTS public.comps_cache (
  postcode TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  source TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comps_cache_fetched_at
  ON public.comps_cache (fetched_at DESC);

-- Ensure existing public/free enrichment tables are present for launch areas.
CREATE TABLE IF NOT EXISTS public.postcode_geo_cache (
  postcode TEXT PRIMARY KEY,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  source TEXT NOT NULL DEFAULT 'postcodes.io',
  raw JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_postcode_geo_cache_fetched_at
  ON public.postcode_geo_cache (fetched_at DESC);

CREATE TABLE IF NOT EXISTS public.property_enrichment_cache (
  property_id UUID PRIMARY KEY,
  postcode TEXT,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_enrichment_cache_fetched_at
  ON public.property_enrichment_cache (fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_enrichment_cache_postcode
  ON public.property_enrichment_cache (postcode);

CREATE TABLE IF NOT EXISTS public.ppd_sales (
  id BIGSERIAL PRIMARY KEY,
  transaction_id TEXT,
  price INTEGER,
  date_of_transfer DATE,
  postcode TEXT,
  property_type TEXT,
  new_build BOOLEAN,
  tenure TEXT,
  paon TEXT,
  saon TEXT,
  street TEXT,
  locality TEXT,
  town_city TEXT,
  district TEXT,
  county TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ppd_sales_transaction_id
  ON public.ppd_sales (transaction_id)
  WHERE transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ppd_sales_postcode_date
  ON public.ppd_sales (postcode, date_of_transfer DESC);

CREATE INDEX IF NOT EXISTS idx_ppd_sales_date
  ON public.ppd_sales (date_of_transfer DESC);
