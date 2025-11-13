-- Align public.properties schema with application expectations
-- Safe to run multiple times due to IF NOT EXISTS guards

begin;

-- Core listing fields
alter table if exists public.properties add column if not exists external_id text;
alter table if exists public.properties add column if not exists title text;
alter table if exists public.properties add column if not exists description text;
alter table if exists public.properties add column if not exists price numeric;
alter table if exists public.properties add column if not exists bedrooms integer;
alter table if exists public.properties add column if not exists bathrooms integer;
alter table if exists public.properties add column if not exists property_type text;
alter table if exists public.properties add column if not exists address text;
alter table if exists public.properties add column if not exists postcode text;
alter table if exists public.properties add column if not exists latitude numeric;
alter table if exists public.properties add column if not exists longitude numeric;
alter table if exists public.properties add column if not exists source text;
alter table if exists public.properties add column if not exists url text;
alter table if exists public.properties add column if not exists image_urls text[];
alter table if exists public.properties add column if not exists data jsonb;

-- Basic indexes used by queries
create index if not exists idx_properties_postcode on public.properties(postcode);
create index if not exists idx_properties_source on public.properties(source);

commit;

-- Note: If PostgREST schema cache is stale, you may need to trigger a refresh by
-- touching the schema or waiting briefly; Supabase typically refreshes automatically
-- on DDL changes. If issues persist, try restarting the PostgREST service or
-- running an empty ALTER to force a refresh.
