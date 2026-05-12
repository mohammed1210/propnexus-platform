-- Investor Deal Triage + Offer Intelligence foundations.

alter table if exists public.properties
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists initial_price numeric,
  add column if not exists previous_price numeric,
  add column if not exists last_price_change_at timestamptz,
  add column if not exists price_change_count integer not null default 0,
  add column if not exists price_history jsonb not null default '[]'::jsonb;

update public.properties
set first_seen_at = coalesce(first_seen_at, created_at, now()),
    last_seen_at = coalesce(last_seen_at, updated_at, created_at, now()),
    initial_price = coalesce(initial_price, price)
where first_seen_at is null or last_seen_at is null or initial_price is null;

create or replace function public.properties_listing_history_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.first_seen_at := coalesce(new.first_seen_at, new.created_at, now());
    new.last_seen_at := coalesce(new.last_seen_at, now());
    new.initial_price := coalesce(new.initial_price, new.price);
    new.price_history := coalesce(new.price_history, '[]'::jsonb);
    new.price_change_count := coalesce(new.price_change_count, 0);
    return new;
  end if;

  new.first_seen_at := coalesce(old.first_seen_at, new.first_seen_at, old.created_at, now());
  new.last_seen_at := now();
  new.initial_price := coalesce(old.initial_price, new.initial_price, old.price, new.price);
  new.price_history := coalesce(old.price_history, new.price_history, '[]'::jsonb);
  new.price_change_count := coalesce(old.price_change_count, new.price_change_count, 0);

  if old.price is distinct from new.price and old.price is not null and new.price is not null then
    new.previous_price := old.price;
    new.last_price_change_at := now();
    new.price_change_count := coalesce(old.price_change_count, 0) + 1;
    new.price_history := coalesce(old.price_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'old_price', old.price,
      'new_price', new.price,
      'changed_at', now(),
      'direction', case when new.price < old.price then 'reduction' else 'increase' end
    ));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_properties_listing_history_guard on public.properties;
create trigger trg_properties_listing_history_guard
before insert or update on public.properties
for each row execute function public.properties_listing_history_guard();

create index if not exists idx_properties_last_price_change_at on public.properties (last_price_change_at desc nulls last);
create index if not exists idx_properties_price_change_count on public.properties (price_change_count desc);

create table if not exists public.investor_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  label text not null default 'Deal alert',
  search_query text,
  filters jsonb not null default '{}'::jsonb,
  min_discovery_score integer,
  include_tiers text[] not null default array['prime','strong'],
  frequency text not null default 'daily',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sent_at timestamptz
);

create index if not exists idx_investor_alerts_user_active on public.investor_alerts (user_id, active);
create index if not exists idx_investor_alerts_frequency on public.investor_alerts (frequency) where active;

alter table public.investor_alerts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='investor_alerts' and policyname='investor_alerts_owner_select') then
    create policy investor_alerts_owner_select on public.investor_alerts for select using (user_id = auth.jwt()->>'sub');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='investor_alerts' and policyname='investor_alerts_owner_insert') then
    create policy investor_alerts_owner_insert on public.investor_alerts for insert with check (user_id = auth.jwt()->>'sub');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='investor_alerts' and policyname='investor_alerts_owner_update') then
    create policy investor_alerts_owner_update on public.investor_alerts for update using (user_id = auth.jwt()->>'sub') with check (user_id = auth.jwt()->>'sub');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='investor_alerts' and policyname='investor_alerts_owner_delete') then
    create policy investor_alerts_owner_delete on public.investor_alerts for delete using (user_id = auth.jwt()->>'sub');
  end if;
end $$;