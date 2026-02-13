# PropNexus

PropNexus helps investors evaluate UK property deals faster: browse listings, open a detail page, and review yield/ROI/discount signals alongside area intel and comparable sales.

## What’s in this repo

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind
- **Backend**: FastAPI (Python)
- **Database**: Supabase (Postgres)
- **Auth/Billing**: Clerk (and related webhooks)

## Local setup

This repo is split into a FastAPI backend and a Next.js frontend.

### 1) Environment variables

Create env files for each app.

**Backend**: `backend/.env`

Typical values:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `CLERK_SECRET_KEY` (if auth endpoints/webhooks are enabled)

**Frontend**: `frontend/.env.local`

Typical values:

- `NEXT_PUBLIC_BACKEND_URL` (e.g. `http://localhost:8000`)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

Feature flags live in `frontend/lib/flags.ts` and are driven by `NEXT_PUBLIC_FEATURE_*` env vars.

### 2) Run the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3) Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

### 4) Seed / sample data

- Sample data exists under `data/`.
- If you use Supabase locally, apply migrations and seed data as needed for your environment.

## Launch Week 1 highlights

- **Listings pagination wired end-to-end** (backend `limit`/`offset` + UI page controls)
- **Map experience improvements** (pins + gallery/preview behavior)
- **Filter bar improvements** (compact sticky bar + better filter interactions)

## Off-market (optional)

The off-market module exists, but is intended to be **disabled by default for initial launch** (behind feature flags / gating). Enable it only when you’re ready to support and monitor that flow.

## Docs

Product + engineering docs live in `docs/` (deployment, runbooks, feature flags, Clerk setup, billing, and troubleshooting).
