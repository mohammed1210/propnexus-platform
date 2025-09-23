# Development Setup

Monorepo:
- Frontend: Next.js in `/frontend`
- Backend: FastAPI in `/backend`
- Scripts & docs at repo root
Deploy: Vercel (frontend), Railway (backend). DB: Supabase.
Timezone: Europe/London.

## Prereqs
- Node 18+
- Python 3.11+
- pnpm/yarn/npm (prefer pnpm via `corepack enable`)
- pip
- Accounts: Vercel, Railway, Supabase

## First run

```bash
# Frontend
cd frontend
corepack enable
pnpm i || yarn || npm i
cp .env.example .env
pnpm dev
# http://localhost:3000

# Backend
cd ../backend
python -m venv .venv && source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
# http://localhost:8000/health
