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
- **Note**: For production, consider adding a `published` column if you need draft/published workflow in the future

## How to Apply the Fix

### Step 1: Apply the Migration to Supabase

**Option A: Using Supabase Dashboard (Recommended)**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/20251122_fix_properties_rls_remove_published.sql`
4. Click "Run" to execute the migration
5. Verify success (should see "Success. No rows returned")

**Option B: Using Supabase CLI**
```bash
cd supabase
supabase db push
```

**Option C: Manual SQL**
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

### Step 1.5: Verify the Migration
After applying, verify the policies are correct:
```sql
SELECT schemaname, tablename, policyname, permissive, roles, qual
FROM pg_policies
WHERE tablename = 'properties';
```

You should see two policies (`properties_read_auth` and `properties_read_anon`) with `qual` set to `true` (not referencing `published`).

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

## Verification Steps

### 1. Check Backend Connection
Test the backend `/properties` endpoint:
```bash
curl http://localhost:8000/properties?limit=10
```

Expected: JSON array with up to 10 properties

### 2. Check Frontend
1. Open the listings page: `http://localhost:3000/listings`
2. Open browser DevTools (F12) → Network tab
3. Look for a request to `/properties`
4. Verify it returns a 200 status with property data
5. Count should show "200 properties found" (or however many you have)

### 3. Test Both Authenticated and Anonymous
- Test while logged out (anonymous access)
- Test while logged in (authenticated access)
- Both should show the same properties

### 4. Check Database Directly
In Supabase SQL Editor:
```sql
-- Check total properties
SELECT COUNT(*) FROM properties;

-- Verify RLS policies
SELECT * FROM pg_policies WHERE tablename = 'properties';

-- Test as anon role
SET ROLE anon;
SELECT COUNT(*) FROM properties;
RESET ROLE;

-- Test as authenticated role  
SET ROLE authenticated;
SELECT COUNT(*) FROM properties;
RESET ROLE;
```

## Future Improvements
If you want to support a "published/draft" workflow in the future:
1. Add a `published` boolean column to the properties table (default: true)
2. Update the RLS policies to check this column
3. Add admin UI to toggle the published status

## Troubleshooting

### Still Seeing 0 Properties?

1. **Verify the migration was applied**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'properties';
   ```
   If you don't see `properties_read_auth` and `properties_read_anon` policies, re-run the migration.

### 2. Check Backend Environment Variables
Ensure one of these is set in `backend/.env` (checked in this order):
1. `SUPABASE_SERVICE_ROLE_KEY` (preferred, standard naming)
2. `SUPABASE_SERVICE_ROLE` (legacy, used in some deployments)
3. `SUPABASE_KEY` (fallback, ensure this is a service role key, not anon key)
   
   And:
   - `SUPABASE_URL`

3. **Check frontend environment variables**
   Ensure one of these is set:
   - `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000` (or your backend URL)
   - `NEXT_PUBLIC_API_BASE=http://localhost:8000` (or your backend URL)

4. **Test backend directly**
   ```bash
   curl http://localhost:8000/properties?limit=5
   ```
   Should return JSON with properties. If you get a 500 error, check backend logs.

5. **Check backend logs**
   Look for errors like:
   - "Supabase is not configured"
   - "Failed to list properties"
   
   These indicate environment variables are missing.

6. **Restart services after applying migration**
   - Restart backend: `cd backend && uvicorn main:app --reload`
   - Clear frontend cache: Hard refresh (Ctrl+Shift+R) or restart dev server

### Backend Returns Empty Array?
This means the RLS policies are still blocking access. Verify:
1. The migration was applied successfully
2. The properties table has data: `SELECT COUNT(*) FROM properties;`
3. You're using a service role key (not anon key) in the backend

### Frontend Shows "Loading..." Forever?
1. Check browser console for errors
2. Check Network tab - is the request to `/properties` failing?
3. Verify `NEXT_PUBLIC_BACKEND_URL` or `NEXT_PUBLIC_API_BASE` is set correctly
4. Check CORS settings if backend is on a different domain
