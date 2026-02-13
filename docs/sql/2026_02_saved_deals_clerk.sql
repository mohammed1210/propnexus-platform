-- 2026-02: Saved Deals + Clerk identity compatibility
--
-- Problem:
--   - Clerk user IDs look like "user_..." (TEXT)
--   - Legacy schema used saved_deals.user_id UUID (auth.users)
--   - Writing Clerk IDs into a UUID column causes: 22P02 invalid input syntax for type uuid
--
-- This migration is designed to be SAFE + IDEMPOTENT.
-- It avoids assumptions about created_at and only touches identity columns.

-- 1) Add clerk_user_id column (text)
alter table public.saved_deals
add column if not exists clerk_user_id text;

-- 2) Drop NOT NULL on user_id (allow NULL for Clerk-keyed rows)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saved_deals'
      and column_name = 'user_id'
      and is_nullable = 'NO'
  ) then
    alter table public.saved_deals
    alter column user_id drop not null;
  end if;
end $$;

-- 3) Backfill clerk_user_id from user_id::text when missing
-- (only runs if user_id exists)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saved_deals'
      and column_name = 'user_id'
  ) then
    update public.saved_deals
    set clerk_user_id = user_id::text
    where clerk_user_id is null
      and user_id is not null;
  end if;
end $$;

-- 4) Index clerk_user_id for fast lookups
create index if not exists idx_saved_deals_clerk_user_id
on public.saved_deals (clerk_user_id);

-- 5) Delete invalid rows (both identities NULL), then add identity check constraint
-- (Constraint add can fail if rows violate it, so we delete first.)
delete from public.saved_deals
where user_id is null
  and clerk_user_id is null;

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

-- 6) Uniqueness for Clerk (clerk_user_id, property_id) IF property_id exists
-- NOTE: this can fail if duplicates already exist.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saved_deals'
      and column_name = 'property_id'
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
