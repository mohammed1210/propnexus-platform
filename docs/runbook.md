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
