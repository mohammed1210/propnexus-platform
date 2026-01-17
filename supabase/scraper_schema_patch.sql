-- ============================================================
-- PROPNEXUS — SCRAPER SCHEMA PATCH (RUN IN SUPABASE SQL EDITOR)
-- Purpose:
--  - Ensure the backend ingestion routes can upsert safely
--  - Enforce dedupe via UNIQUE (source, external_id)
--  - Ensure common columns exist (url, last_seen_at, analytics fields)
-- Idempotent: safe to run multiple times.
-- ============================================================

begin;

-- Core ingestion keys used by backend upsert: on_conflict="source,external_id"
alter table if exists public.properties
  add column if not exists source text,
  add column if not exists external_id text;

-- URL field used by the backend + frontend
alter table if exists public.properties
  add column if not exists url text;

-- Freshness tracking (import routes populate this)
alter table if exists public.properties
  add column if not exists last_seen_at timestamptz default now();

-- Optional but commonly used display/filters
alter table if exists public.properties
  add column if not exists location text,
  add column if not exists postcode text,
  add column if not exists imageurl text,
  add column if not exists yield_percent numeric,
  add column if not exists roi_percent numeric,
  add column if not exists investment_type text;

-- If historical duplicates exist, remove them keeping the newest row (by ctid)
-- Note: uses ctid as a pragmatic tie-breaker.
delete from public.properties p
using public.properties d
where p.ctid < d.ctid
  and p.source is not null
  and p.external_id is not null
  and p.source = d.source
  and p.external_id = d.external_id;

-- Drop any legacy global uniqueness on external_id (breaks multi-source ingestion)
alter table public.properties
  drop constraint if exists properties_external_id_key;

drop index if exists public.properties_external_id_key;

-- Ensure a unique index exists for (source, external_id)
create unique index if not exists uq_properties_source_external
  on public.properties (source, external_id);

-- Ensure a named constraint exists (re-uses the index above)
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

-- Helpful indexes for query patterns
create index if not exists idx_properties_created_at on public.properties(created_at desc);
create index if not exists idx_properties_location on public.properties(location);
create index if not exists idx_properties_postcode on public.properties(postcode);

commit;
