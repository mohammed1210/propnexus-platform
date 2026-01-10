-- Migration: enforce unique (source, external_id) on public.properties
-- Date: 2026-01-10
-- Purpose:
--   - Allow same external_id across different sources
--   - Enforce dedupe within a source
--   - Support correct PostgREST upsert conflict targeting
--   - (Optional) Track freshness via last_seen_at

begin;

-- Optional but recommended: track listing freshness
alter table public.properties
  add column if not exists last_seen_at timestamptz default now();

-- If historical duplicates exist, remove them keeping the newest row (by ctid)
-- Note: this uses ctid as a pragmatic tie-breaker.
delete from public.properties p
using public.properties d
where p.ctid < d.ctid
  and p.source is not null
  and p.external_id is not null
  and p.source = d.source
  and p.external_id = d.external_id;

-- Drop global uniqueness on external_id (it breaks multi-source ingestion)
alter table public.properties
  drop constraint if exists properties_external_id_key;

drop index if exists public.properties_external_id_key;

-- Ensure a unique index exists for (source, external_id)
create unique index if not exists uq_properties_source_external
  on public.properties (source, external_id);

-- Add a named constraint (re-uses the index above)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'properties_source_external_id_key'
      and conrelid = 'public.properties'::regclass
  ) then
    alter table public.properties
      add constraint properties_source_external_id_key
      unique using index uq_properties_source_external;
  end if;
end $$;

commit;
