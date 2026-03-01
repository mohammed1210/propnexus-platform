-- PropNexus Platform Database Schema
-- This file contains the complete database schema for the PropNexus platform

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table - stores user account information
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  stripe_customer_id text unique,
  plan text default 'free',
  plan_status text default 'active',
  current_period_end bigint,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint users_plan_check check (plan in ('free', 'pro', 'investor'))
);

-- Subscriptions table - tracks user subscription status
create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  email text unique not null,
  stripe_customer_id text not null,
  subscription_id text unique,
  status text not null default 'inactive',
  price_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Prices table - Stripe price metadata (added to satisfy relationship for admin stats)
-- Using stripe_price_id as the primary key to align with existing subscriptions.price_id text values.
create table if not exists public.prices (
  stripe_price_id text primary key,
  product_id text,
  nickname text,
  unit_amount integer, -- stored in smallest currency unit (e.g. cents)
  currency text,
  billing_interval text, -- e.g. month, year
  created_at timestamp with time zone default now()
);

-- Idempotent foreign key from subscriptions.price_id -> prices.stripe_price_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass
      AND contype = 'f'
      AND conname = 'subscriptions_price_id_fkey'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_price_id_fkey
      FOREIGN KEY (price_id)
      REFERENCES public.prices (stripe_price_id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END$$;

-- Index to speed up lookups/join on subscriptions.price_id
create index if not exists idx_subscriptions_price_id on public.subscriptions(price_id);

comment on table public.prices is 'Stripe prices referenced by subscriptions.price_id';
comment on column public.subscriptions.price_id is 'References public.prices.stripe_price_id';

-- Saved deals table - user-saved property deals
create table if not exists public.saved_deals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  clerk_user_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Properties table - property listings
create table if not exists public.properties (
  id uuid primary key default uuid_generate_v4(),
  external_id text,
  title text not null,
  description text,
  price numeric,
  bedrooms integer,
  bathrooms integer,
  property_type text,
  address text,
  postcode text,
  latitude numeric,
  longitude numeric,
  source text,
  url text,
  image_urls text[],
  data jsonb,
  -- Investment analytics columns (snake_case)
  yield_percent numeric,
  roi_percent numeric,
  investment_type text,
  bmv numeric,
  -- Additional display fields
  location text,
  imageurl text,
  last_seen_at timestamptz default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint properties_source_external_id_key unique (source, external_id)
);

-- Smart-search Step-4 compatibility column.
-- Some docs/use-cases refer to a `listing` table; keep no-op-safe statement.
alter table if exists public.listing add column if not exists yield numeric;
-- Canonical table used in this repo.
alter table if exists public.properties add column if not exists yield numeric;

create schema if not exists analytics;

create table if not exists analytics.filter_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  facet text not null,
  value text not null,
  inserted_at timestamptz default now()
);

grant usage on schema analytics to service_role;
grant insert, select on table analytics.filter_clicks to service_role;

-- Payments log table - tracks payment events
create table if not exists public.payments_log (
  id uuid primary key default uuid_generate_v4(),
  user_email text,
  event text,
  amount numeric,
  created_at timestamp with time zone default now()
);

-- Property notes table - user notes on properties
create table if not exists public.property_notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  note text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create indexes for better query performance
create index if not exists idx_users_email on public.users(email);
create index if not exists idx_users_stripe_customer on public.users(stripe_customer_id);
create index if not exists idx_users_plan on public.users(plan);
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);
create index if not exists idx_subscriptions_email on public.subscriptions(email);
create index if not exists idx_subscriptions_customer on public.subscriptions(stripe_customer_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);
create index if not exists idx_properties_postcode on public.properties(postcode);
create index if not exists idx_properties_source on public.properties(source);
create index if not exists idx_properties_investment_type on public.properties(investment_type);
create index if not exists idx_properties_yield_percent on public.properties(yield_percent);
create index if not exists idx_properties_roi_percent on public.properties(roi_percent);
create index if not exists idx_properties_location on public.properties(location);
create index if not exists idx_saved_deals_user on public.saved_deals(user_id);
create index if not exists idx_saved_deals_clerk_user_id on public.saved_deals(clerk_user_id);

-- Add column comments for documentation
comment on column public.users.plan is 'Subscription plan: free, pro, investor';
comment on column public.users.plan_status is 'Subscription status: active, past_due, canceled, trialing';
comment on column public.users.current_period_end is 'Unix timestamp of current billing period end';
comment on column public.users.stripe_customer_id is 'Stripe customer ID for billing';

-- Enable Row Level Security (RLS)
alter table public.saved_deals enable row level security;
alter table public.property_notes enable row level security;

-- RLS Policies for saved_deals (users can only access their own)
drop policy if exists "Users can view their own saved deals" on public.saved_deals;
create policy "Users can view their own saved deals" on public.saved_deals
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own saved deals" on public.saved_deals;
create policy "Users can insert their own saved deals" on public.saved_deals
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own saved deals" on public.saved_deals;
create policy "Users can update their own saved deals" on public.saved_deals
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own saved deals" on public.saved_deals;
create policy "Users can delete their own saved deals" on public.saved_deals
  for delete using (auth.uid() = user_id);

-- RLS Policies for property_notes (users can only access their own)
drop policy if exists "Users can view their own notes" on public.property_notes;
create policy "Users can view their own notes" on public.property_notes
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own notes" on public.property_notes;
create policy "Users can insert their own notes" on public.property_notes
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own notes" on public.property_notes;
create policy "Users can update their own notes" on public.property_notes
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own notes" on public.property_notes;
create policy "Users can delete their own notes" on public.property_notes
  for delete using (auth.uid() = user_id);

-- Properties table is public (read-only for authenticated users)
alter table public.properties enable row level security;

drop policy if exists "Properties are viewable by authenticated users" on public.properties;
create policy "Properties are viewable by authenticated users" on public.properties
  for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

-- Users and subscriptions tables are managed by service role only
alter table public.users enable row level security;
alter table public.subscriptions enable row level security;

-- Allow authenticated users to view their own user record
drop policy if exists "Users can view their own record" on public.users;
create policy "Users can view their own record" on public.users
  for select using (auth.jwt() ->> 'email' = email);

-- Allow authenticated users to view their own subscription
drop policy if exists "Users can view their own subscription" on public.subscriptions;
create policy "Users can view their own subscription" on public.subscriptions
  for select using (auth.uid() = user_id or auth.jwt() ->> 'email' = email);

-- Function to automatically update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers to update updated_at on record changes
drop trigger if exists set_updated_at on public.users;
create trigger set_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.subscriptions;
create trigger set_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.properties;
create trigger set_updated_at
  before update on public.properties
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.saved_deals;
create trigger set_updated_at
  before update on public.saved_deals
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.property_notes;
create trigger set_updated_at
  before update on public.property_notes
  for each row execute function public.handle_updated_at();
