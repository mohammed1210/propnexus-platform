# API Cache (Comps & Area Intel)

**Endpoints**
- `GET /comps/{postcode}`
- `GET /area-intel/{key}`

**Storage**
- Supabase tables:
  - `comps_cache(postcode text, payload jsonb, fetched_at timestamptz)`
  - `area_intel_cache(area_key text, payload jsonb, fetched_at timestamptz)`

**Strategy**
- On read: if `now() - fetched_at < 24 hours` → return cached payload.
- Otherwise: fetch from provider (currently a deterministic mock), upsert the row, and return.
- If Supabase env isn’t present, endpoints **skip caching** but still return provider data (keeps local/dev simple).

**Notes**
- Replace `backend/services/providers.py` with real integrations when ready.
- Cache writes are best-effort and never fail the request path.
