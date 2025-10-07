# PO3 — Production Polish & Monetization

## Envs
Create/update **.env.example** files:
- `NEXT_PUBLIC_API_BASE`
- `OPENAI_API_KEY` (backend only)
- `SUPABASE_URL`, `SUPABASE_KEY` (service role on backend only)
- `STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `MAILGUN_DOMAIN`, `MAILGUN_API_KEY`
- `OFF_MARKET_ADMIN_TOKEN`

## Rollout Steps
1. Merge Phase branches (UI polish → AI routes → Paywall → Scrapers → Export/CRM → CI).
2. Deploy FE (Vercel) / BE (Railway/Render).
3. Verify webhooks & rate-limits by tier.

## Troubleshooting
- “N/A” on summary → ensure `NEXT_PUBLIC_API_BASE` is set and backend `/gpt/summary` reachable.
- 401 on `/scrape/*` → set `OFF_MARKET_ADMIN_TOKEN` and send header `x-api-key`.
- Dark mode inputs unreadable → confirm `globals.css` variables applied.
