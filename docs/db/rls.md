# Row-Level Security (RLS) with Supabase

This guide explains how to enable and test row-level security for the `saved_deals` table.

## Enable RLS and apply policies

Run the following in your Supabase project (via SQL editor or `supabase db push`):

```sql
alter table public.saved_deals enable row level security;

-- See supabase/policies/saved_deals.sql for policies.
