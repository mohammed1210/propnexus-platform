-- Evidence-backed Top Deal ranking fields for scrape/discovery ordering.
-- AI Deal Score remains stored in score/score_breakdown.

alter table if exists public.properties
  add column if not exists top_deal_score integer,
  add column if not exists top_deal_tier text,
  add column if not exists top_deal_reasons jsonb default '[]'::jsonb,
  add column if not exists search_metadata jsonb default '{}'::jsonb;

create index if not exists idx_properties_top_deal_score
  on public.properties (top_deal_score desc nulls last, created_at desc nulls last);

create index if not exists idx_properties_top_deal_tier
  on public.properties (top_deal_tier)
  where top_deal_tier is not null;

comment on column public.properties.top_deal_score is
  'Deterministic scrape/discovery ranking score, separate from AI Deal Score.';
comment on column public.properties.top_deal_reasons is
  'Evidence-backed explanations for why the listing was surfaced.';
comment on column public.properties.search_metadata is
  'Portal search pass metadata used to find the listing.';
