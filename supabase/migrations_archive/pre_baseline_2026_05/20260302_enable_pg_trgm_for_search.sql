create extension if not exists pg_trgm;

create index if not exists idx_properties_title_trgm
  on public.properties using gin (lower(title) gin_trgm_ops);

create index if not exists idx_properties_location_trgm
  on public.properties using gin (lower(location) gin_trgm_ops);

create index if not exists idx_properties_postcode_trgm
  on public.properties using gin (lower(postcode) gin_trgm_ops);
