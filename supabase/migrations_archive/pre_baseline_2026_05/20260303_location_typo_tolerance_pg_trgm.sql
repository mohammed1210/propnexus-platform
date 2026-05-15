create extension if not exists pg_trgm;

create index if not exists idx_properties_location_trgm
  on public.properties using gin (lower(location) gin_trgm_ops);

create index if not exists idx_properties_postcode_trgm
  on public.properties using gin (lower(postcode) gin_trgm_ops);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'city'
  ) then
    execute 'create index if not exists idx_properties_city_trgm on public.properties using gin (lower(city) gin_trgm_ops)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'town'
  ) then
    execute 'create index if not exists idx_properties_town_trgm on public.properties using gin (lower(town) gin_trgm_ops)';
  end if;
end $$;
