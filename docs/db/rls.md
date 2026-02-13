# Row-Level Security (RLS) with Supabase

This guide explains how to enable and test row-level security for the `saved_deals` table.

## Enable RLS and apply policies

Run the following in your Supabase project (via SQL editor or `supabase db push`):

```sql
alter table public.saved_deals enable row level security;

-- See supabase/policies/saved_deals.sql for policies.

```

## Saved Deals: Clerk identity migration

If you are using Clerk for authentication, you must apply the Saved Deals identity migration so the database can store Clerk user IDs (which look like `user_...`).

### Apply via Supabase Dashboard SQL Editor

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Create a new query
4. Copy/paste the contents of `docs/sql/2026_02_saved_deals_clerk.sql`
5. Click **Run**

This migration is designed to be idempotent (safe to re-run).

### Verify it worked

In the SQL Editor, you can confirm the new column and constraint exist:

```sql
select column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public'
	and table_name = 'saved_deals'
	and column_name in ('user_id', 'clerk_user_id');

select conname
from pg_constraint
where conrelid = 'public.saved_deals'::regclass
	and conname = 'saved_deals_requires_identity';
```
