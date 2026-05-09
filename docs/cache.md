# API Cache (Comps & Area Intel)

## Endpoints

- `GET /comps/{postcode}`
- `GET /area-intel/{key}`

## Storage

- Supabase tables:
  - `comps_cache(postcode text, payload jsonb, fetched_at timestamptz)`
  - `area_intel_cache(area_key text, payload jsonb, fetched_at timestamptz)`

## Strategy

- On read: if `now() - fetched_at` is inside the configured TTL → return cached payload.
- Otherwise: fetch from live/internal providers, upsert the row, and return.
- If Supabase env isn’t present, endpoints **skip caching** but still return provider data (keeps local/dev simple).

## Launch-area cache refresh

When Area Intel provider fields change, clear cached launch-area payloads before live verification so old payloads do not hide new source details:

```sql
DELETE FROM public.area_intel_cache
WHERE area_key LIKE 'IG%'
  OR area_key LIKE 'RM%'
  OR area_key LIKE 'UB%'
  OR area_key LIKE 'HA%'
  OR area_key LIKE 'SL%'
  OR area_key LIKE 'TW%';

DELETE FROM public.comps_cache
WHERE postcode LIKE 'IG%'
  OR postcode LIKE 'RM%'
  OR postcode LIKE 'UB%'
  OR postcode LIKE 'HA%'
  OR postcode LIKE 'SL%'
  OR postcode LIKE 'TW%';
```

Some older environments used `key` instead of `area_key` for `area_intel_cache`; use the column that exists in that environment.

## Notes

- Provider logic lives in `backend/services/providers.py`.
- Cache writes (when enabled) are best-effort and never fail the request path.
- Rent and crime payloads must include source metadata. Do not cache placeholder, mock, or UI-only values as provider evidence.
