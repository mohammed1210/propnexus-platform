create schema if not exists analytics;

alter table if exists analytics.search_clicks
  add column if not exists query text,
  add column if not exists property_id uuid,
  add column if not exists position int,
  add column if not exists filters_json jsonb,
  add column if not exists session_id text,
  add column if not exists created_at timestamptz default now();

update analytics.search_clicks
set
  property_id = coalesce(property_id, listing_id),
  position = coalesce(position, rank),
  filters_json = coalesce(filters_json, '{}'::jsonb),
  created_at = coalesce(created_at, inserted_at)
where property_id is null
   or position is null
   or filters_json is null
   or created_at is null;

alter table analytics.search_clicks
  alter column query set default '',
  alter column filters_json set default '{}'::jsonb,
  alter column session_id set default '';

create index if not exists idx_search_clicks_dedupe
  on analytics.search_clicks (session_id, query, property_id, created_at desc);
