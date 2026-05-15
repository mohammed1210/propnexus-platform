-- Launch data hardening after production baseline 20260515180247.
-- This migration avoids inventing price-history events; it only normalizes baseline fields.

update public.properties
set source = case
	when btrim(lower(source)) in ('rightmove', 'rm') then 'rightmove'
	when btrim(lower(source)) = 'zoopla' then 'zoopla'
	when btrim(lower(source)) in ('onthemarket', 'otm') then 'onthemarket'
	when btrim(lower(source)) in ('spareroom', 'spare room', 'spare-room') then 'spareroom'
	else source
end
where source is not null
	and source <> case
		when btrim(lower(source)) in ('rightmove', 'rm') then 'rightmove'
		when btrim(lower(source)) = 'zoopla' then 'zoopla'
		when btrim(lower(source)) in ('onthemarket', 'otm') then 'onthemarket'
		when btrim(lower(source)) in ('spareroom', 'spare room', 'spare-room') then 'spareroom'
		else source
	end;

update public.properties
set
	first_seen_at = coalesce(first_seen_at, created_at, now()),
	last_seen_at = coalesce(last_seen_at, score_updated_at, created_at, now()),
	initial_price = coalesce(initial_price, price),
	price_change_count = coalesce(price_change_count, 0),
	price_history = coalesce(price_history, '[]'::jsonb)
where first_seen_at is null
	 or last_seen_at is null
	 or initial_price is null
	 or price_change_count is null
	 or price_history is null;

create index if not exists idx_properties_last_seen_at_launch on public.properties using btree (last_seen_at desc nulls last);
create index if not exists idx_properties_first_seen_at_launch on public.properties using btree (first_seen_at desc nulls last);
create index if not exists idx_saved_deals_user_id_launch on public.saved_deals using btree (user_id);
create index if not exists idx_subscriptions_user_id_launch on public.subscriptions using btree (user_id);
create index if not exists idx_subscriptions_customer_id_launch on public.subscriptions using btree (customer_id);

alter function public.properties_listing_history_guard() set search_path = public;
alter function public.handle_updated_at() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.sync_property_images() set search_path = public;
alter function public.update_tradesman_rating() set search_path = public;

drop policy if exists "Allow inserts to properties" on public.properties;
drop policy if exists "insert saved_deals for all" on public.saved_deals;
drop policy if exists "insert off_market public" on public.off_market_deals;
