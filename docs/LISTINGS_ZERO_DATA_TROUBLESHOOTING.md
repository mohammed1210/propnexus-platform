# Listings Page Zero-Data Troubleshooting Guide

## Overview

This document describes potential scenarios that could cause the listings page to show 0 data and how to diagnose and fix them.

## Schema Compatibility Issues (FIXED)

### Problem
The backend was querying columns that didn't exist in the database schema:
- `investmentType` - Investment strategy type (HMO, BTL, SA, etc.)
- `yield_percent` - Investment yield percentage
- `roi_percent` - Return on investment percentage
- `imageurl` - Single image URL
- `location` - Property location text
- `bmv` - Below market value discount

### Impact
When these columns don't exist in the database, queries return empty results or fail, causing the listings page to show 0 properties.

### Solution
Applied migration `20251123_add_missing_property_columns.sql` which adds all missing columns to the properties table. The main `schema.sql` has also been updated to include these columns for new deployments.

### Verification
Run this query in Supabase SQL Editor to verify columns exist:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'properties' AND table_schema = 'public'
ORDER BY ordinal_position;
```

Expected columns include:
- `id`, `external_id`, `title`, `description`, `price`, `bedrooms`, `bathrooms`
- `property_type`, `address`, `postcode`, `latitude`, `longitude`
- `source`, `url`, `image_urls`, `data`
- `yield_percent`, `roi_percent`, `bmv` ✅ NEW
- `imageurl`, `location`, `investmentType` ✅ NEW

## Backend URL Configuration

### Problem
The frontend may be pointing to the wrong backend URL or localhost when deployed.

### Symptoms
- Listings page shows 0 properties in production
- Console shows CORS errors or connection refused
- Works locally but not in production

### Solution
Ensure environment variables are set correctly in your deployment:

**Priority order (as implemented in `frontend/app/listings/page.tsx` line 289):**
1. `NEXT_PUBLIC_BACKEND_URL` (preferred)
2. `NEXT_PUBLIC_API_BASE` (fallback)
3. `NEXT_PUBLIC_API_URL` (fallback)
4. `http://localhost:8000` (local development fallback)

**For Railway deployment:**
```bash
NEXT_PUBLIC_BACKEND_URL=https://your-backend.up.railway.app
```

**For Vercel deployment:**
```bash
NEXT_PUBLIC_BACKEND_URL=https://your-backend.up.railway.app
```

### Verification
Check the Network tab in browser DevTools:
- Look for requests to `/properties`
- Verify the request URL is pointing to your production backend
- Check for 200 status code

## Row Level Security (RLS) Issues

### Problem
RLS policies on the properties table may block access to data.

### Solution Applied
Migration `20251122_fix_properties_rls_remove_published.sql` fixed RLS policies to:
- Allow authenticated users to read all properties
- Allow anonymous users to read all properties

### Verification
Run this query to check RLS policies:
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'properties';
```

Expected policies:
- `properties_read_auth` - Allows authenticated users (USING true)
- `properties_read_anon` - Allows anonymous users (USING true)

### If RLS Still Blocks Data
Temporarily disable RLS for testing (NOT recommended for production):
```sql
ALTER TABLE public.properties DISABLE ROW LEVEL SECURITY;
```

## No Data in Database

### Problem
The properties table is empty or has no matching records.

### Symptoms
- Query returns empty array `[]`
- No errors in console
- Backend returns 200 status

### Verification
Check if there's any data:
```sql
SELECT COUNT(*) FROM public.properties;
```

If count is 0, you need to ingest data:
```bash
# Using the CSV ingestion script
npm run ingest:csv -- data/listings.sample.csv --source=rightmove

# Or run the live scraper (if configured)
npm run ingest:live
```

## Backend Service Not Running

### Problem
The backend service is down or not deployed.

### Symptoms
- Network errors in console
- "Failed to fetch" errors
- Connection timeout

### Verification
Test backend health endpoint:
```bash
curl https://your-backend.up.railway.app/health
```

Expected response:
```json
{"ok": true}
```

### Solution
- Check Railway deployment logs
- Verify Procfile or start command is correct
- Ensure PORT environment variable is set
- Check Railway service is running

## CORS Issues

### Problem
Backend rejects requests from frontend due to CORS configuration.

### Symptoms
- CORS errors in browser console
- Pre-flight OPTIONS requests failing
- Status 0 or blocked requests

### Solution
Ensure backend `ALLOWED_ORIGINS` includes your frontend URL:
```bash
ALLOWED_ORIGINS=http://localhost:3000,https://propnexus-platform.vercel.app,https://*.vercel.app
```

In `backend/main.py`, verify:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Filter/Query Issues

### Problem
Filters are too restrictive, excluding all properties.

### Symptoms
- Works without filters
- Adding filters returns 0 results
- Specific investment types return no data

### Verification
Test with no filters:
```
https://your-frontend.vercel.app/listings
```

Then add filters one by one:
```
?types=HMO
?min=100000&max=500000
?beds=3
```

### Solution
- Check that properties in database have the filtered values
- Verify investmentType values match filter options exactly (case-sensitive)
- Ensure numeric filters (price, beds, baths) are reasonable

### Query to check investment type distribution:
```sql
SELECT "investmentType", COUNT(*) 
FROM public.properties 
WHERE "investmentType" IS NOT NULL
GROUP BY "investmentType";
```

## Supabase Connection Issues

### Problem
Backend cannot connect to Supabase.

### Symptoms
- "Supabase is not configured" error
- 500 Internal Server Error
- Backend logs show connection errors

### Solution
Verify environment variables are set:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important:** Use the **service role key** (not anon key) for backend operations.

### Verification
Test Supabase connection from backend:
```python
from supabase import create_client
import os

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)
result = supabase.table("properties").select("id").limit(1).execute()
print(result.data)
```

## Field Mapping Issues

### Problem
Backend returns data with field names that frontend doesn't recognize.

### Symptoms
- Data appears in Network tab but not rendered on page
- Properties show as blank cards
- Missing images, titles, or other fields

### Solution
The frontend maps backend fields correctly (see `frontend/app/listings/page.tsx` line 321-336):
```typescript
const mappedData = (data || []).map((prop: any) => ({
  id: prop.id,
  title: prop.title,
  location: prop.location,
  price: prop.price,
  bedrooms: prop.bedrooms,
  bathrooms: prop.bathrooms,
  description: prop.description,
  yield_percent: prop.yield_percent,
  roi_percent: prop.roi_percent,
  imageurl: prop.imageurl,
  latitude: prop.latitude,
  longitude: prop.longitude,
  created_at: prop.created_at,
  investment_type: prop.investmentType, // ⚠️ Note camelCase -> snake_case
}));
```

If you see different field names in the backend response, update this mapping.

## Testing Checklist

When diagnosing zero-data issues, check in this order:

### 1. Local Testing
```bash
# Start backend
cd backend
PORT=8000 python3 -m backend.main

# Start frontend  
cd frontend
npm run dev
```

Visit http://localhost:3000/listings

### 2. Environment Variables
Check `.env.local` in frontend:
```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Database Schema
Run schema verification query (see "Schema Compatibility Issues" section above).

### 4. Data Exists
Check if properties table has data:
```sql
SELECT COUNT(*), 
       COUNT("investmentType"), 
       COUNT(yield_percent),
       COUNT(imageurl)
FROM public.properties;
```

### 5. RLS Policies
Verify policies allow public access (see "Row Level Security Issues" section above).

### 6. Backend Health
Test health endpoint:
```bash
curl http://localhost:8000/health
curl http://localhost:8000/properties?limit=5
```

### 7. Frontend API Call
Check browser Network tab for:
- Request URL
- Response status
- Response body
- CORS headers

## Additional Resources

- **API URL Resolution Test:** `frontend/__tests__/lib/api-url-resolution.spec.tsx`
- **Schema Validation Test:** `frontend/__tests__/listings-schema-validation.spec.tsx`
- **Migration Files:** `supabase/migrations/`
- **Schema Documentation:** `supabase/SCHEMA_UPDATES.md`

## Common Solutions Summary

| Issue | Quick Fix |
|-------|-----------|
| Missing columns | Apply migration `20251123_add_missing_property_columns.sql` |
| RLS blocking | Check `20251122_fix_properties_rls_remove_published.sql` applied |
| Wrong backend URL | Set `NEXT_PUBLIC_BACKEND_URL` in Vercel/Railway |
| No data | Run `npm run ingest:csv` or scraper |
| CORS error | Add frontend URL to `ALLOWED_ORIGINS` |
| Connection error | Verify backend is running and accessible |

## Support

If issues persist after following this guide:
1. Check backend logs in Railway dashboard
2. Check frontend logs in Vercel dashboard
3. Review Supabase logs in Supabase dashboard
4. Test the API endpoint directly with curl/Postman
5. Verify all migrations have been applied in order
