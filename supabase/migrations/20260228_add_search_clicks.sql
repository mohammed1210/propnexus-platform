create schema if not exists analytics;

create table if not exists analytics.search_clicks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  query_id    uuid not null,
  listing_id  uuid not null,
  rank        int,
  inserted_at timestamptz default now()
);
