# Property Types: Canonical classification + API filtering

This project uses a deterministic classifier to normalize messy source labels and free-text into a stable, canonical `property_type`.

## Canonical values

The backend emits one of these strings:

- `Detached`
- `Semi-detached`
- `Terraced`
- `Flat/Apartment`
- `Studio`
- `Maisonette`
- `Bungalow`
- `Land`
- `Commercial`
- `HMO/Block`
- `Other`

## Where it’s populated

New imports/upserts classify **before** writing to Supabase:

- Preferred storage (if DB columns exist): top-level `property_type` and `raw_property_type`
- Fallback storage (always safe, no migration): `data.property_type` and `data.raw_property_type`

## API behavior

### Response fields

`GET /properties` ensures every returned item includes `property_type`:

1. Uses `row.property_type` if present
2. Else uses `row.data.property_type` if present
3. Else computes `property_type` on the fly from title/description/data (response-only; does not write back)

`raw_property_type` is included when available.

### Filtering

Filter by canonical type via query param:

```bash
curl -sS "$BASE/properties?property_type=Terraced&limit=25" | jq
```

You can pass a comma-separated OR list:

```bash
curl -sS "$BASE/properties?property_type=Terraced,Semi-detached&limit=25" | jq
```

The backend accepts common synonyms case-insensitively (e.g. `Apartment` -> `Flat/Apartment`, `Terrace` -> `Terraced`).

Implementation detail:
- If the `properties.property_type` column exists, filtering is pushed down to Supabase.
- If the column does not exist, the backend safely falls back to Python-side filtering over a capped candidate pool (to avoid breaking paging/sorts).

## Admin backfill (optional)

If you want to backfill canonical types for existing rows:

```bash
curl -sS -X POST "$BASE/properties/admin/backfill-property-types?limit=500&offset=0" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

Response includes:
- `processed_count`
- `updated_count`
- `sample_updates` (first few ids + computed types)

Run repeatedly with increasing `offset` to process more rows.
