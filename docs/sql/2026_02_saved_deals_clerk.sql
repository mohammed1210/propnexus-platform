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

-- 1.5) Add saved_at timestamp (do not rely on created_at existing)
alter table public.saved_deals
add column if not exists saved_at timestamptz default now();

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

-- 4.1) Index user_id + property_id when present
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saved_deals'
      and column_name = 'user_id'
  ) then
    execute 'create index if not exists idx_saved_deals_user_id on public.saved_deals (user_id)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saved_deals'
      and column_name = 'property_id'
  ) then
    execute 'create index if not exists idx_saved_deals_property_id on public.saved_deals (property_id)';
  end if;
end $$;

-- 5) Delete invalid rows (both identities NULL), then add identity check constraint
-- (Constraint add can fail if rows violate it, so we delete first.)
delete from public.saved_deals
where user_id is null
  and clerk_user_id is null;

-- 5.1) Delete duplicates before adding uniqueness constraints (no created_at required)
-- Keep one row per (clerk_user_id, property_id) using ctid ordering.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saved_deals'
      and column_name = 'property_id'
  ) then
    -- Clerk-keyed duplicates
    execute '
      delete from public.saved_deals a
      using public.saved_deals b
      where a.ctid < b.ctid
        and a.clerk_user_id is not null
        and b.clerk_user_id is not null
        and a.property_id is not null
        and b.property_id is not null
        and a.clerk_user_id = b.clerk_user_id
        and a.property_id = b.property_id
    ';

    -- UUID-keyed duplicates
    execute '
      delete from public.saved_deals a
      using public.saved_deals b
      where a.ctid < b.ctid
        and a.user_id is not null
        and b.user_id is not null
        and a.property_id is not null
        and b.property_id is not null
        and a.user_id = b.user_id
        and a.property_id = b.property_id
    ';
  end if;
end $$;

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

-- 7) Optional uniqueness for legacy UUID users (user_id, property_id)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saved_deals'
      and column_name = 'property_id'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'saved_deals'
        and column_name = 'user_id'
    ) then
      if not exists (
        select 1
        from pg_constraint
        where conname = 'saved_deals_unique_uuid_property'
      ) then
        alter table public.saved_deals
        add constraint saved_deals_unique_uuid_property
        unique (user_id, property_id);
      end if;
    end if;
  end if;
end $$;
