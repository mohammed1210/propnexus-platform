# PropNexus Runbook

## Health

- **App**: visit `/api/diag` – reports env presence and connection to Supabase.
- **Supabase**: console → Table Editor → `properties`.
- **Railway ingest-worker**: service should start with `bash scripts/railway-start.sh`, dispatch to `python -m backend.tasks.ingestion_runner`, log `[ingest-worker] starting`, and keep running between cycles. When Railway provides `PORT`, the worker exposes a minimal `/health` responder for the shared Railway health check.
- **Railway deploy targets**: GitHub Actions deploys the API to `propnexus-backend` and the active ingest worker to `function-bun`. A red GitHub commit status named `vivacious-embrace - ingest-worker` is an obsolete Railway status context from an old integration/service; if it persists, remove or disconnect it in Railway/GitHub integration settings rather than changing application code.

## Environments

- **Required env** (frontend/public):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_API_BASE`
- **Required env** (backend/private):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- **Required env** (Railway ingest-worker):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SCRAPER_MODE=direct`
  - `INGEST_SOURCES=zoopla,onthemarket,spareroom`
  - `INGEST_LOCATIONS=London,Manchester,Liverpool,Birmingham` or the active launch list
  - `INGEST_INTERVAL_SECONDS=900`
- Vercel → Project → Settings → Environment Variables. Redeploy after changes.

While ScraperAPI is off, leave `SCRAPERAPI_KEY` empty/omitted and keep Rightmove opt-in. The worker should be treated as degraded when an individual direct source is blocked or returns 0, and failed only when the process exits or cannot start.

Direct-mode worker policy: `SCRAPER_MODE=direct` disables ScraperAPI fallback even if a stale key exists in the environment. Only set `SCRAPERAPI_ALLOW_FALLBACK=true` when deliberately re-enabling paid fallback behavior.

## Launch Backfills and Health Checks

Run these commands from the repository root with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured. They do not require ScraperAPI.

```bash
python -m backend.scripts.backfill_top_deals --limit 50 --dry-run
python -m backend.scripts.backfill_property_quality --limit 50 --dry-run
python -m backend.scripts.launch_health_report
```

Expected backfill dry-run output includes `total_scanned`, `updated`, `skipped`, and `errors`; `errors: 0` is required before running without `--dry-run`. The launch-health report should show `Supabase configured: True`, `Scraper mode: direct`, and the current direct source list.

To apply the backfills after dry-run verification:

```bash
python -m backend.scripts.backfill_top_deals --batch-size 100 --force
python -m backend.scripts.backfill_property_quality --batch-size 100 --force
```

## Data Access

Row Level Security:

```sql
alter table public.properties enable row level security;
create policy "Public can read properties"
on public.properties
for select
to anon, authenticated
using (true);
```

## Deal Action / Contact Agent workflow

- The production baseline is established at `supabase/migrations/20260515180247_production_baseline_2026_05.sql`.
- Archived migrations under `supabase/migrations_archive/` are audit/reference files only and should not be applied after the baseline.
- New DB changes must be added as migrations after the production baseline.
- Do not backfill or fabricate agent details. Only copy real source URLs/contact fields from scraper/provider payloads.

## Investor Intel, Listing History and Alerts

The baseline includes Offer Intelligence history fields and saved-alert criteria storage. Apply any post-baseline launch hardening migration before final launch verification.

After applying the migration:

- Run a fresh scrape/import so `first_seen_at`, `last_seen_at`, `initial_price`, and Top Deal metadata are refreshed on current rows.
- Run a later repeat scrape/import to begin accumulating meaningful `last_seen_at` updates and verified price-change history.
- Keep alert delivery claims honest: `/investor-alerts` CRUD is live, while `/investor-alerts/digest-preview` only builds the scheduler/email payload unless a real email job is separately configured and verified.

Safe Supabase verification snippets:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'properties'
  and column_name in (
    'first_seen_at', 'last_seen_at', 'initial_price', 'previous_price',
    'last_price_change_at', 'price_change_count', 'price_history'
  )
order by column_name;
```

```sql
select to_regclass('public.investor_alerts') as investor_alerts_table;
```

```sql
select tgname
from pg_trigger
where tgrelid = 'public.properties'::regclass
  and tgname = 'trg_properties_listing_history_guard';
```

```sql
select id, title, first_seen_at, last_seen_at, initial_price, price,
       previous_price, price_change_count, price_history
from public.properties
order by last_seen_at desc nulls last
limit 10;
```

```sql
select id, user_id, label, search_query, include_tiers, frequency, active,
       created_at, last_sent_at
from public.investor_alerts
order by created_at desc
limit 10;
```

If any column/table/trigger check returns no rows, stop launch verification and re-run the migration before testing the UI.

## Supabase Security Verification SQL

List broad permissive policies:

```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
    coalesce(qual, '') ilike '%true%'
    or coalesce(with_check, '') ilike '%true%'
    or roles::text ilike '%anon%'
  )
order by tablename, policyname;
```

List public functions without a pinned `search_path`:

```sql
select n.nspname as schema, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (
    select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg
    where cfg like 'search_path=%'
  )
order by p.proname;
```

List public storage bucket policies:

```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage'
order by tablename, policyname;
```

## Search Guardrails (#331)

- **Alert rule file**: `infra/prometheus/alerts/search-alerts.yml`
- **Zero-result alert**: `SearchZeroResultsRateHigh` fires when zero-result rate exceeds 15% for 10 minutes.
- **Prometheus counters used**:
  - `search_requests_total{endpoint=...}`
  - `search_zero_results_total{endpoint=...}`
  - `search_ml_fallback_total{reason=...}`

### ML fallback spike guardrail

When ML rerank failures spike, `/api/v1/search` auto-falls back to legacy ranking.

- `SMART_SEARCH_ML_5XX_SPIKE_THRESHOLD` (default `3`)
- `SMART_SEARCH_ML_5XX_SPIKE_WINDOW_SECONDS` (default `300`)
- `SMART_SEARCH_ML_FALLBACK_COOLDOWN_SECONDS` (default `600`)

The API response includes:

- `ml_requested`
- `ml_enabled` (effective mode)
- `ml_fallback_active`
- `fallback_reason` (`ml_5xx` or `spike_cooldown`)
