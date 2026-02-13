-- Feb 2026: Support Clerk user IDs in saved_deals.
-- Problem: Clerk user IDs look like "user_..." (text) but saved_deals.user_id is UUID.
-- Fix: Store Clerk IDs in a text column, and allow user_id to be NULL.

-- 1) Add Clerk user id column (text)
alter table public.saved_deals
add column if not exists clerk_user_id text;

-- 2) Allow saved_deals rows that are keyed by Clerk instead of auth.users
-- (keeps existing Supabase Auth rows intact)
alter table public.saved_deals
alter column user_id drop not null;

-- 3) Backfill clerk_user_id for existing rows (safe no-op if already set)
-- Copies UUID user_id into clerk_user_id as a string.
update public.saved_deals
set clerk_user_id = user_id::text
where clerk_user_id is null
  and user_id is not null;

-- 4) Index for fast lookups
create index if not exists idx_saved_deals_clerk_user_id
on public.saved_deals (clerk_user_id);

-- 5) Optional integrity: require at least one identity column
-- (keeps legacy uuid user_id support while enabling Clerk)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_deals_requires_identity'
  ) then
    alter table public.saved_deals
    add constraint saved_deals_requires_identity
    check (user_id is not null or clerk_user_id is not null);
  end if;
end $$;

-- 6) Optional uniqueness: prevent duplicates per Clerk user + property
-- Only applies if property_id exists as a column.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='saved_deals'
      and column_name='property_id'
  ) then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'saved_deals_unique_clerk_property'
    ) then
      alter table public.saved_deals
      add constraint saved_deals_unique_clerk_property
      unique (clerk_user_id, property_id);
    end if;
  end if;
end $$;
