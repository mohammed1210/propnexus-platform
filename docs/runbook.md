# PropNexus Runbook

## Health

- **App**: visit `/api/diag` – reports env presence and connection to Supabase.
- **Supabase**: console → Table Editor → `properties`.

## Environments

- **Required env** (frontend/public):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_API_BASE`
- **Required env** (backend/private):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Vercel → Project → Settings → Environment Variables. Redeploy after changes.

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

- Run `supabase/migrations/20260509_deal_action_fields.sql` in Supabase before enabling saved-deal progress tracking.
- The migration adds nullable original listing/contact columns on `properties` and `deal_status`, `contacted_at`, `last_action_at`, `action_notes` on `saved_deals`.
- If this migration has not been applied, `PATCH /saved-deals/status` returns a clear migration-required error while the rest of the property detail page remains usable.
- Do not backfill or fabricate agent details. Only copy real source URLs/contact fields from scraper/provider payloads.

## Investor Intel, Listing History and Alerts Migration

Run `supabase/migrations/20260512_investor_intel_history_alerts.sql` in Supabase before relying on Offer Intelligence history fields, price-change tracking, or saved deal alerts in production.

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
