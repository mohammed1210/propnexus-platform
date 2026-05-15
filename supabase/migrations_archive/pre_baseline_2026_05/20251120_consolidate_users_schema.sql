-- Migration: Consolidate users table schema with all billing columns
-- Date: 2025-11-20
-- Purpose: Ensure users table has all columns required by backend billing code
--          This migration is idempotent and safe to run on existing databases.

-- Ensure users table exists with base columns
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Add stripe_customer_id column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='users' and column_name='stripe_customer_id'
  ) then
    alter table public.users add column stripe_customer_id text;
    create unique index if not exists users_stripe_customer_id_key on public.users(stripe_customer_id);
  end if;
end $$;

-- Add plan column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='users' and column_name='plan'
  ) then
    alter table public.users add column plan text default 'free';
  end if;
end $$;

-- Add plan_status column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='users' and column_name='plan_status'
  ) then
    alter table public.users add column plan_status text default 'active';
  end if;
end $$;

-- Add current_period_end column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='users' and column_name='current_period_end'
  ) then
    alter table public.users add column current_period_end bigint;
  end if;
end $$;

-- Update or create plan constraint
alter table public.users drop constraint if exists users_plan_check;
alter table public.users
  add constraint users_plan_check
  check (plan in ('free', 'pro', 'investor'));

-- Create indexes for performance (idempotent)
create index if not exists idx_users_email on public.users(email);
create index if not exists idx_users_stripe_customer_id on public.users(stripe_customer_id);
create index if not exists idx_users_plan on public.users(plan);

-- Add helpful column comments
comment on column public.users.plan is 'Subscription plan: free, pro, investor';
comment on column public.users.plan_status is 'Subscription status: active, past_due, canceled, trialing';
comment on column public.users.current_period_end is 'Unix timestamp of current billing period end';
comment on column public.users.stripe_customer_id is 'Stripe customer ID for billing';

-- Enable RLS if not already enabled
alter table public.users enable row level security;

-- Recreate RLS policy for users viewing their own record
drop policy if exists "Users can view their own record" on public.users;
create policy "Users can view their own record" on public.users
  for select using (auth.jwt() ->> 'email' = email);

-- Create updated_at trigger if it doesn't exist
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.users;
create trigger set_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();
