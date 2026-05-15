-- May 2026: Deal action workflow fields.
-- Adds source/contact fields for original listing handoff and saved-deal progress tracking.

-- Saved deal action tracking
alter table public.saved_deals
add column if not exists deal_status text not null default 'not_contacted',
add column if not exists contacted_at timestamptz,
add column if not exists last_action_at timestamptz,
add column if not exists action_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_deals_deal_status_check'
  ) then
    alter table public.saved_deals
    add constraint saved_deals_deal_status_check
    check (deal_status in (
      'not_contacted',
      'contacted',
      'viewing_booked',
      'offer_prepared',
      'offer_made',
      'rejected',
      'archived'
    ));
  end if;
end $$;

create index if not exists idx_saved_deals_deal_status
on public.saved_deals (deal_status);

create index if not exists idx_saved_deals_last_action_at
on public.saved_deals (last_action_at desc);

-- Original source/contact fields. These are nullable and must only be populated from real scraper/provider values.
alter table public.properties
add column if not exists source_url text,
add column if not exists original_listing_url text,
add column if not exists listing_url text,
add column if not exists property_url text,
add column if not exists external_url text,
add column if not exists original_url text,
add column if not exists rightmove_url text,
add column if not exists zoopla_url text,
add column if not exists onthemarket_url text,
add column if not exists agent_name text,
add column if not exists agency_name text,
add column if not exists branch_name text,
add column if not exists agent_phone text,
add column if not exists contact_phone text,
add column if not exists agent_email text,
add column if not exists contact_email text;

-- Preserve already-normalized listing URLs for existing rows without inventing data.
update public.properties
set source_url = coalesce(source_url, url),
    original_listing_url = coalesce(original_listing_url, url)
where url is not null
  and trim(url) <> ''
  and (source_url is null or original_listing_url is null);

create index if not exists idx_properties_source_url
on public.properties (source_url)
where source_url is not null;

create index if not exists idx_properties_original_listing_url
on public.properties (original_listing_url)
where original_listing_url is not null;
