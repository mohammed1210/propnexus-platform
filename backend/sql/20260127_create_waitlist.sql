-- Create waitlist table (early access / email capture)
-- Safe to apply multiple times.

create extension if not exists pgcrypto;

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  source_page text,
  created_at timestamptz not null default now()
);

create index if not exists waitlist_created_at_idx
  on public.waitlist (created_at desc);
