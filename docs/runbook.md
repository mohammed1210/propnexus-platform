# PropNexus Runbook

## Health
- **App**: visit `/api/diag` – reports env presence and connection to Supabase.
- **Supabase**: console → Table Editor → `properties`.

## Environments
- **Required env** (public):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Vercel → Project → Settings → Environment Variables. Redeploy after changes.

## Data Access
Row Level Security:
```sql
alter table public.properties enable row level security;
create policy "Public can read properties"
on public.properties
for select
to anon, authenticated
using (true);
