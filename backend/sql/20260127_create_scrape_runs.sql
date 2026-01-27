-- Create scrape_runs table (one row per scrape/import run)
-- Safe to apply multiple times.

create extension if not exists pgcrypto;

create table if not exists public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  location text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'started',
  count_inserted int not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists scrape_runs_source_created_at_idx
  on public.scrape_runs (source, created_at desc);

create index if not exists scrape_runs_created_at_idx
  on public.scrape_runs (created_at desc);
