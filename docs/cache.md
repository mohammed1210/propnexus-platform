# Cache Design: comps + area-intel (24h TTL)

**Tables**
- `comps_cache(postcode TEXT PRIMARY KEY, payload JSONB, fetched_at TIMESTAMP WITH TIME ZONE)`
- `area_intel_cache(area_key TEXT PRIMARY KEY, payload JSONB, fetched_at TIMESTAMP WITH TIME ZONE)`

**Policy**
- A GET request first attempts to read the most recent cached row.
- If `now - fetched_at < 24h`, it is a cache **hit** → return cached payload.
- Otherwise, call the provider (currently a deterministic stub), **upsert** the payload with `fetched_at=now`, and return that payload.

**Notes**
- Provider stubs live in `backend/services/providers.py` — replace with real APIs later.
- Cache write failures are non-fatal; the API still returns provider data.
- Tests monkeypatch the DB layer and providers for deterministic behavior.
