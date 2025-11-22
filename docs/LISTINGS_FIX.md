# Fix for Listings Page Showing 0 Properties

## Issue
The listings page was showing 0 properties for both authenticated and anonymous users, despite having 200 properties in the Supabase database.

## Root Cause
The RLS (Row Level Security) policies on the `properties` table referenced a `published` column that doesn't exist in the actual schema. This caused all queries to fail silently and return 0 results.

The problematic RLS policy was:
```sql
CREATE POLICY "properties_read_anon"
ON public.properties FOR SELECT
TO anon
USING (published = true);
```

But the `properties` table schema has no `published` column.

## Solution

### 1. Backend Code Fix
Updated `backend/routes/properties_routes.py` to check for multiple possible environment variable names for the Supabase key:
- `SUPABASE_SERVICE_ROLE_KEY` (preferred)
- `SUPABASE_SERVICE_ROLE` (fallback)
- `SUPABASE_KEY` (last resort)

This ensures the backend can connect to Supabase regardless of which variable name is used.

### 2. Database Migration
Created migration `supabase/migrations/20251122_fix_properties_rls_remove_published.sql` that:
- Drops the old RLS policies that reference the non-existent `published` column
- Creates new RLS policies that allow all users (authenticated and anonymous) to read all properties

## How to Apply the Fix

### Step 1: Apply the Migration to Supabase
Run this SQL in your Supabase SQL Editor:

```sql
-- Fix RLS policies for properties table
DROP POLICY IF EXISTS "properties_read_auth" ON public.properties;
DROP POLICY IF EXISTS "properties_read_anon" ON public.properties;

CREATE POLICY "properties_read_auth"
ON public.properties FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "properties_read_anon"
ON public.properties FOR SELECT
TO anon
USING (true);
```

Or use the Supabase CLI:
```bash
supabase db push
```

### Step 2: Verify Environment Variables
Ensure your backend `.env` file has one of these set:
- `SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>`
- `SUPABASE_SERVICE_ROLE=<your-service-role-key>`
- `SUPABASE_KEY=<your-service-role-key>`

And the URL:
- `SUPABASE_URL=https://your-project.supabase.co`

### Step 3: Restart Services
1. Restart your backend server
2. Clear frontend cache and reload

## Expected Result
After applying the migration:
- Anonymous users can browse all 200 properties
- Authenticated users can browse all 200 properties
- The listings page loads data via the backend `/properties` API
- No more direct Supabase queries from the frontend

## Future Improvements
If you want to support a "published/draft" workflow in the future:
1. Add a `published` boolean column to the properties table (default: true)
2. Update the RLS policies to check this column
3. Add admin UI to toggle the published status
