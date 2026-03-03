create schema if not exists analytics;

create table if not exists analytics.search_queries (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  results_count int not null default 0,
  filters_json jsonb not null default '{}'::jsonb,
  session_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_search_queries_created_at
  on analytics.search_queries (created_at desc);

create index if not exists idx_search_queries_query
  on analytics.search_queries (query);

grant usage on schema analytics to service_role;
grant insert, select on table analytics.search_queries to service_role;
