-- PropNexus Platform Database Schema
-- This file contains the complete database schema for the PropNexus platform

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table - stores user account information
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  stripe_customer_id text unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
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

-- Saved deals table - user-saved property deals
create table if not exists public.saved_deals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Properties table - property listings
create table if not exists public.properties (
  id uuid primary key default uuid_generate_v4(),
  external_id text unique,
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
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

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
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);
create index if not exists idx_subscriptions_email on public.subscriptions(email);
create index if not exists idx_subscriptions_customer on public.subscriptions(stripe_customer_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);
create index if not exists idx_properties_postcode on public.properties(postcode);
create index if not exists idx_properties_source on public.properties(source);
create index if not exists idx_saved_deals_user on public.saved_deals(user_id);

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
