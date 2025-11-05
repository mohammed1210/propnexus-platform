DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_properties_listing_id_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_properties_listing_id_unique ON public.properties(listing_id);
  END IF;
END $$;
