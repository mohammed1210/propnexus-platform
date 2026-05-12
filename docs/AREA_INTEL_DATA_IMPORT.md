# Area Intel / Comps PPD Data Import

Use this runbook to load official HM Land Registry Price Paid Data into `public.ppd_sales` so `/comps/{postcode}` and `/area-intel/{postcode}` can show real sold-price evidence.

No fake, mock, random, or hand-authored sold-price rows should be inserted. The backend does not download PPD during normal runtime or page load.

## Source data

Download the official HM Land Registry Price Paid Data CSV from:

- [HM Land Registry Price Paid Data downloads](https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads)

Use the standard CSV order supplied by HM Land Registry:

1. transaction id
2. price
3. date of transfer
4. postcode
5. property type
6. new build flag
7. tenure
8. PAON
9. SAON
10. street
11. locality
12. town/city
13. district
14. county
15. PPD category type
16. record status

The importer writes only the fields present in `public.ppd_sales`; category and record-status fields are intentionally ignored.

## Required environment variables

Run the import from a trusted environment with Supabase service-role access:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `PPD_CSV_PATH` — default CSV path when no path is supplied.
- `PPD_POSTCODE_PREFIX` — comma-separated prefix filter, for example `IG,RM,UB`.
- `PPD_IMPORT_BATCH_SIZE` — upsert batch size, default `500`.

## Launch-prefix import

For launch, import only the target prefixes first: IG, RM, UB, HA, SL, TW.

From the repo root, after downloading the official CSV to `./data/ppd.csv`, run:

```bash
python backend/scripts/import_ppd_sales.py \
  --csv ./data/ppd.csv \
  --prefix IG \
  --prefix RM \
  --prefix UB \
  --prefix HA \
  --prefix SL \
  --prefix TW
```

The import is safe to rerun. Rows are upserted into `public.ppd_sales` by `transaction_id`, postcodes are normalized to uppercase, and bad rows are skipped before upload.

To import a single outward area while testing:

```bash
python backend/scripts/import_ppd_sales.py --csv ./data/ppd.csv --prefix IG3
```

Only run an unfiltered import intentionally; the national file is large:

```bash
python backend/scripts/import_ppd_sales.py --csv ./data/ppd.csv
```

## Verify imported rows

Run these in Supabase SQL editor after the import:

```sql
SELECT COUNT(*) AS ppd_sales_count FROM public.ppd_sales;

SELECT postcode, price, date_of_transfer, property_type
FROM public.ppd_sales
WHERE postcode ILIKE 'IG%'
ORDER BY date_of_transfer DESC
LIMIT 10;

SELECT postcode, price, date_of_transfer, property_type
FROM public.ppd_sales
WHERE postcode ILIKE 'RM%'
ORDER BY date_of_transfer DESC
LIMIT 10;

SELECT postcode, price, date_of_transfer, property_type
FROM public.ppd_sales
WHERE postcode ILIKE 'UB%'
ORDER BY date_of_transfer DESC
LIMIT 10;
```

## Clear cached empty responses

If `/comps` or `/area-intel` was called before `ppd_sales` was populated, clear stale cache rows for the launch outward codes:

```sql
DELETE FROM public.comps_cache
WHERE postcode LIKE 'IG%'
  OR postcode LIKE 'RM%'
  OR postcode LIKE 'UB%'
  OR postcode LIKE 'HA%'
  OR postcode LIKE 'SL%'
  OR postcode LIKE 'TW%';

DELETE FROM public.area_intel_cache
WHERE key LIKE 'IG%'
  OR key LIKE 'RM%'
  OR key LIKE 'UB%'
  OR key LIKE 'HA%'
  OR key LIKE 'SL%'
  OR key LIKE 'TW%';
```

Alternatively, wait for the configured cache TTLs (`COMPS_TTL_HOURS` and `AREA_INTEL_TTL_HOURS`) to expire.

## Verify backend endpoints

After import and any cache clear, verify deployed responses:

```bash
curl https://propnexus-backend-production.up.railway.app/comps/IG3
curl https://propnexus-backend-production.up.railway.app/area-intel/IG3
```

Expected result: `sales` should include Land Registry PPD records for `/comps/IG3`, and `/area-intel/IG3` should report `source_details.sales` as `land_registry_ppd` when matching rows exist.

## Schema reminder

`public.ppd_sales` must have a unique index on `transaction_id` for rerunnable imports:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_ppd_sales_transaction_id
  ON public.ppd_sales (transaction_id)
  WHERE transaction_id IS NOT NULL;
```
