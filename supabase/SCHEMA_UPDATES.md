# Database Schema Updates - November 2025

## Overview

This document describes the schema changes made to align the Supabase database with the backend code expectations, particularly for user subscription management.

## What Changed

### Users Table Updates

The `users` table has been updated to include all subscription-related columns that the backend billing system requires:

**New columns added:**
- `plan` (text, default 'free') - User's subscription plan tier
- `plan_status` (text, default 'active') - Subscription status from Stripe
- `current_period_end` (bigint) - Unix timestamp when current billing period ends

**Constraint added:**
- `users_plan_check` - Ensures plan is one of: 'free', 'pro', 'investor'

**New index:**
- `idx_users_plan` - For efficient plan-based queries

### Schema Consistency

The `schema.sql` file has been updated to reflect the complete current schema including:
- All user columns with defaults and constraints
- Proper documentation via SQL comments
- RLS policies that reference existing columns
- Updated indexes for performance

### Subscriptions Table

The `subscriptions` table already has the `user_id` column and the RLS policy correctly references it. This table is preserved for potential future use or legacy data, but the primary billing logic uses the `users` table directly.

## How to Apply These Changes

### Option 1: For New/Empty Supabase Projects

If you're setting up a fresh Supabase project:

1. Go to the SQL Editor in your Supabase dashboard
2. Copy and paste the entire contents of `supabase/schema.sql`
3. Execute the SQL
4. Verify tables were created successfully

### Option 2: For Existing Supabase Projects

If you already have data in your Supabase project:

1. **Backup your data first** (recommended)
   ```sql
   -- In Supabase SQL Editor, export current users
   SELECT * FROM public.users;
   ```

2. Run the consolidation migration:
   - Go to the SQL Editor in your Supabase dashboard
   - Copy contents of `supabase/migrations/20251120_consolidate_users_schema.sql`
   - Execute the SQL
   - This migration is **idempotent** and **non-destructive** - it only adds missing columns and constraints

3. Verify the changes:
   ```sql
   -- Check the users table structure
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'users' AND table_schema = 'public'
   ORDER BY ordinal_position;
   
   -- Verify the constraint exists
   SELECT constraint_name, check_clause
   FROM information_schema.check_constraints
   WHERE constraint_name = 'users_plan_check';
   ```

### Option 3: Running All Migrations in Order

If you want to apply migrations incrementally (not recommended unless needed):

Run each migration file in `supabase/migrations/` in chronological order:
1. `2025-11-04_add_users_plan_cols.sql`
2. `20251106_add_investor_to_plan.sql`
3. `20251120_consolidate_users_schema.sql` (new)
4. Other migrations as needed

## Verification Steps

After applying the changes, verify everything is working:

### 1. Check Table Structure
```sql
\d public.users
```

Expected columns:
- id (uuid)
- email (text, unique, not null)
- stripe_customer_id (text, unique)
- plan (text, default 'free')
- plan_status (text, default 'active')
- current_period_end (bigint)
- created_at (timestamp)
- updated_at (timestamp)

### 2. Check RLS Policies
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('users', 'subscriptions', 'saved_deals', 'property_notes', 'properties');
```

All expected policies should be present and active.

### 3. Test Basic Operations

Test that the backend can read/write user data:
```sql
-- Insert test user (as service role)
INSERT INTO public.users (email, stripe_customer_id, plan)
VALUES ('test@example.com', 'cus_test123', 'free')
ON CONFLICT (email) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id
RETURNING *;

-- Query test user
SELECT id, email, plan, plan_status FROM public.users WHERE email = 'test@example.com';
```

## Backend Code Alignment

The schema now matches what the backend expects:

### stripe_webhook.py
Writes to `users` table with:
- `stripe_customer_id`
- `email`
- `plan` (mapped from Stripe price_id)
- `plan_status` (active, trialing, past_due, canceled)
- `current_period_end` (timestamp)

### users_routes.py
Reads from `users` table:
- `plan` - returns user's subscription tier
- `stripe_customer_id` - returns Stripe customer ID

### stripe_routes.py
Manages Stripe customers:
- `get_or_create_customer()` - creates/updates `stripe_customer_id` in users table

## Important Notes

### No Destructive Changes
- No columns were dropped
- No tables were removed
- All changes are additive
- Existing data is preserved

### Idempotent Migrations
All migration SQL uses:
- `CREATE TABLE IF NOT EXISTS`
- `DO $$ ... IF NOT EXISTS` blocks for columns
- `CREATE INDEX IF NOT EXISTS`
- `DROP POLICY IF EXISTS` before `CREATE POLICY`

This means you can safely run migrations multiple times.

### Legacy Code
The file `backend/utils/billing.py` contains code expecting a `customers` and `subscriptions` table with a different schema. This code is **not currently used** by the application. The active billing logic is in:
- `backend/routes/stripe_webhook.py`
- `backend/routes/stripe_routes.py`
- `backend/routes/users_routes.py`

## Environment Variables

Ensure these environment variables are set:

**Backend:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for server-side operations)
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `STRIPE_PRICE_PRO` - Stripe price ID for Pro tier
- `STRIPE_PRICE_INVESTOR` - Stripe price ID for Investor tier

**Frontend:**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

## Troubleshooting

### "column does not exist" errors
- Run the consolidation migration: `20251120_consolidate_users_schema.sql`
- Verify columns exist with the query in "Verification Steps"

### RLS policy errors
- Ensure you're using the service role key for backend operations
- Check that policies exist with the RLS query above
- Verify `auth.uid()` is available (requires authenticated user)

### Constraint violation errors
- The `users_plan_check` constraint only allows: 'free', 'pro', 'investor'
- Update any code trying to set other plan values

## Support

For issues or questions:
1. Check Supabase logs in the dashboard
2. Review backend application logs
3. Verify environment variables are set correctly
4. Test queries manually in Supabase SQL Editor using service role
