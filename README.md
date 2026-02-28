# PropNexus  [![CI – Sanity test](https://github.com/mohammed1210/propnexus-platform/actions/workflows/sanity-test.yml/badge.svg?branch=main)](https://github.com/mohammed1210/propnexus-platform/actions/workflows/sanity-test.yml)

PropNexus helps investors evaluate UK property deals faster: browse listings, open a detail page, and review yield / ROI / discount signals alongside area intel and comparable sales.

---

## What’s in this repo

| Layer              | Tech                                         | Notes                                            |
|--------------------|----------------------------------------------|--------------------------------------------------|
| **Frontend**       | Next.js (App Router) • TypeScript • Tailwind | Lives in **`/frontend`**                         |
| **Backend**        | FastAPI (Python 3.12)                        | Lives in **`/backend`**                          |
| **Database**       | Supabase (Postgres)                          | SQL migrations + seed scripts in **`/supabase`** |
| **Auth / Billing** | Clerk • Stripe                               | Webhooks in **`/backend/routes`**                |
| **CI / CD**        | GitHub Actions ⇢ Railway / Vercel            | Workflows in **`.github/workflows/`**            |

The **CI – Sanity test** badge above turns ✔️ green or ❌ red any time the backend tests, frontend type-check & lint, or pre-commit hooks fail on `main`.

---

## Local setup

This repo is split into a FastAPI backend and a Next.js frontend.

### 1) Environment variables

Create env files for each app.

**Backend**: `backend/.env`

Typical values:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLERK_SECRET_KEY`

**Frontend**: `frontend/.env.local`

Typical values:

- `NEXT_PUBLIC_BACKEND_URL` (e.g. `http://localhost:8000`)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

Feature-flags live in `frontend/lib/flags.ts` and are driven by `NEXT_PUBLIC_FEATURE_*` env vars.

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

Then open <http://localhost:3000>.

### 4) Seed / sample data

- Sample data lives under `data/`.
- If you use Supabase locally, apply migrations and seed data as needed.

---

## Recent highlights

- **End-to-end listings pagination** (`limit` / `offset` in the API + UI page controls)
- **Improved map UX** (pin clustering, gallery previews)
- **Compact sticky filter bar** with smoother interactions

> _Want to see what’s shipping next? Check the open PRs or the “Sprint” project board._

---

## Off-market module (optional)

The off-market acquisition flow exists, but is **disabled by default for launch** (behind feature flags).
Enable it only when you’re ready to support and monitor that flow in production.

---

## Documentation

Product & engineering docs live in **`/docs`** (deployment runbooks, feature-flag reference, Clerk setup, billing, troubleshooting, etc.).

---

### AI endpoints

- `/gpt/*` (preferred)
- `/ai/*` (legacy alias)

Both serve the same features; new code should use `/gpt/*`.

---

## Contributing

1. Create a feature branch from `main`.
2. Make sure `pre-commit run --all-files` passes locally.
3. Push and open a PR – the **Sanity test** workflow will run automatically.
4. Keep PRs small and focused; squash-merge when CI is green.

Thanks for helping make PropNexus better!
