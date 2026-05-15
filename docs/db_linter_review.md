# DB Linter Review - Launch Hardening

Date: 2026-05-15

## Production Baseline

The active migration chain starts at `supabase/migrations/20260515180247_production_baseline_2026_05.sql`.
Historical migrations are archived in `supabase/migrations_archive/pre_baseline_2026_05/` and should not be applied after the baseline.

## Launch-Critical Fixes Included

- `20260515212555_launch_data_hardening.sql` normalizes obvious property source aliases.
- Listing history baseline fields are populated without inventing price changes.
- Function `search_path` is pinned for known trigger functions:
  - `public.properties_listing_history_guard()`
  - `public.handle_updated_at()`
  - `public.set_updated_at()`
  - `public.sync_property_images()`
  - `public.update_tradesman_rating()`
- Broad public insert policies are removed where backend/service-role flows own writes:
  - `public.properties`: `Allow inserts to properties`
  - `public.saved_deals`: `insert saved_deals for all`
  - `public.off_market_deals`: `insert off_market public`

## Duplicate Index Candidates

Safe candidates to review after launch, not dropped in this pass:

- `idx_ppd_sales_transaction_id` and `idx_ppd_sales_transaction_id_unique` both index `ppd_sales(transaction_id)` with the same partial predicate.
- `idx_area_intel_cache_fetched_at` and `area_intel_cache_fetched_at_idx` overlap on `area_intel_cache(fetched_at)` with different sort direction.
- `idx_comps_cache_fetched_at` and `comps_cache_fetched_at_idx` overlap on `comps_cache(fetched_at)` with different sort direction.
- `idx_off_market_leads_created_at`, `off_market_leads_created_at_desc_idx`, and `off_market_leads_created_at_idx` overlap on `off_market_leads(created_at desc)`.
- `idx_off_market_leads_location` and `off_market_leads_location_idx` overlap on `off_market_leads(location)`.

Leave these until real query patterns are visible in production metrics.

## Launch-Critical Indexes Already Present In Baseline

- `properties(source)`
- `properties(postcode)`
- `properties(top_deal_score desc nulls last, created_at desc nulls last)`
- `properties(top_deal_tier)`
- `properties(price_change_count desc)`
- `saved_deals(clerk_user_id)`

The hardening migration adds missing baseline support indexes for `properties(first_seen_at)`, `properties(last_seen_at)`, `saved_deals(user_id)`, `subscriptions(user_id)`, and `subscriptions(customer_id)`.

## Launch Risks Left Documented

- Off-market remains a soft-launch-hidden/incomplete surface. Keep public UI entry points hidden until ownership, storage and write policy flows have been re-reviewed.
- Rightmove reliability is intentionally not claimed while ScraperAPI is switched off.
- Railway ingest-worker launch health depends on a successful direct-mode deployment and fresh scheduled cycles; individual blocked/empty direct sources are degraded, not fatal.
- Price history will only become meaningful after repeated ingestion cycles; the baseline migration does not fabricate historical price changes.
