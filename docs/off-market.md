# Off-Market Module (Spark Port)

This document explains the Off‑Market module added from the Spark prototype and how to run it in this monorepo.

## What’s included
- Frontend page: `/off-market` with filters and view toggle (cards/table)
- Deal details: `/off-market/[id]`
- Add Deal form with optional image uploads to Supabase Storage
- Generator endpoint used by the page: `POST /off-market/generate-off-market`

## Environment
Frontend (required for reads/inserts):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional (image uploads):
- Supabase Storage bucket named `off-market`

Backend (only needed for secured admin create route):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OFF_MARKET_ADMIN_TOKEN` (if using `/off-market/create` with x-api-key)

## Database migration
We extended the `off_market_deals` table with optional fields used by the Spark UI.

Migration file:
- `supabase/migrations/20251113_off_market_extend.sql`

Apply with Supabase CLI:
```bash
# Install CLI if needed: https://supabase.com/docs/guides/cli
supabase db push  # if using local dev
# or use your existing deploy pipeline that applies SQL in supabase/migrations
```

Apply with psql (managed DB):
```bash
psql "$DATABASE_URL" -f supabase/migrations/20251113_off_market_extend.sql
```

Notes:
- The migration uses `ADD COLUMN IF NOT EXISTS`, so it is safe to rerun.
- The UI gracefully derives `discount_percent` and `investment_score` if missing, based on `price` and `estimated_value`.

## Run locally
Backend:
```bash
cd backend
uvicorn main:app --reload --port 8000
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Open:
```bash
$BROWSER http://localhost:3000/off-market
```

## Data model (selected fields)
- Core: `id`, `title`, `location`, `price`, `bedrooms`, `bathrooms`, `notes`, `source`, `created_at`, `image_url`
- Extended (optional): `address`, `postcode`, `estimated_value`, `refurb_cost`, `rent_potential`, `discount_percent`, `investment_score`, `agent_name`, `agent_phone`, `status`, `imageurl`

## Next steps (optional)
- Implement Export JSON and PDF buttons in detail view
- Add server endpoints for score calculation (if you prefer server‑side)
- Validate CSV imports against table schema and auto‑populate extended fields
