-- Adds structured JSON payload storage for durable scrape/batch status snapshots.
-- Safe to run multiple times.

alter table if exists public.scrape_runs
add column if not exists data jsonb;

create index if not exists scrape_runs_data_gin_idx
on public.scrape_runs using gin (data);
