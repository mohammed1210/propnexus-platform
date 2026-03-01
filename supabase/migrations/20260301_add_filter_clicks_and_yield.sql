alter table if exists public.listing add column if not exists yield numeric;
alter table if exists public.properties add column if not exists yield numeric;

create schema if not exists analytics;

create table if not exists analytics.filter_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  facet text not null,
  value text not null,
  inserted_at timestamptz default now()
);

grant usage on schema analytics to service_role;
grant insert, select on table analytics.filter_clicks to service_role;
