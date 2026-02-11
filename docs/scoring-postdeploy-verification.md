# Scoring: Post-deploy verification

After deploying scoring version `v1.2`, you can verify that outward-only postcodes reliably derive `postcode_band` and trigger rent proxy scoring.

## Environment

```bash
export BASE="https://<your-backend-host>"
export ADMIN_TOKEN="<admin-token>"
```

## Force rescore recent rows

## (Optional) Backfill postcodes first

If you recently improved postcode extraction/backfill, run this once so older rows get a postcode district (e.g. SW11, W1K, EC1V):

```bash
curl -sS -X POST "$BASE/properties/admin/backfill-postcodes?limit=500&force=true" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

## Force rescore recent rows

```bash
curl -sS -X POST "$BASE/properties/admin/backfill-scores?limit=500&force=true" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

## (Optional) Backfill canonical property types

See: `docs/property-types.md`

```bash
curl -sS -X POST "$BASE/properties/admin/backfill-property-types?limit=500&offset=0" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

## Spot-check derived band + rent source

```bash
curl -sS "$BASE/properties?limit=10&sort=created_at" | \
  jq '.items[] | {postcode,score,ver:(.score_breakdown.version),band:(.score_breakdown.inputs.postcode_band),rent_source:(.score_breakdown.inputs.rent_source),rent:(.score_breakdown.inputs.rent_monthly)}'
```

Expected (for rows missing `rent/yield/roi`):

- `ver` is `v1.2`
- `band` is not null
- `rent_source` is `proxy`

For outward-only districts like `SW11`, `W1K`, `EC1V`, `E8`, you should also see `band` set (central/outer/other).
