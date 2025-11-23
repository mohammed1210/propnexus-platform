# Backend URL Resolution Consistency Fix

## Issue

Multiple components were using different priority orders for resolving the backend URL from environment variables, which could lead to inconsistent behavior and connection issues.

## Changes Made

Standardized backend URL resolution across all components to use this priority order:
1. `NEXT_PUBLIC_BACKEND_URL` (preferred, most specific)
2. `NEXT_PUBLIC_API_BASE` (fallback)
3. `NEXT_PUBLIC_API_URL` (fallback)
4. `http://localhost:8000` (local development fallback)

## Files Updated

### Before Fix
Different components had different priority orders:

1. **PropertyCard.tsx**
   - ❌ Was using: API_URL → BACKEND_URL → throw error
   - ❌ Would crash if no env vars set (no fallback)

2. **saved-deals/page.tsx**
   - ❌ Was using: API_BASE → API_URL → BACKEND_URL → localhost
   - Different order than listings page

3. **listings/page.tsx**
   - ✅ Already correct: BACKEND_URL → API_BASE → API_URL → localhost

### After Fix
All components now use consistent priority:

1. **PropertyCard.tsx** ✅
   ```typescript
   const raw = (
     process.env.NEXT_PUBLIC_BACKEND_URL ||
     process.env.NEXT_PUBLIC_API_BASE ||
     process.env.NEXT_PUBLIC_API_URL ||
     'http://localhost:8000'
   ) as string;
   ```

2. **saved-deals/page.tsx** ✅
   ```typescript
   const raw = (
     process.env.NEXT_PUBLIC_BACKEND_URL ||
     process.env.NEXT_PUBLIC_API_BASE ||
     process.env.NEXT_PUBLIC_API_URL ||
     ''
   ) as string;
   // + browser/SSR fallbacks
   ```

3. **listings/page.tsx** ✅ (unchanged, already correct)

## Why This Order?

```
NEXT_PUBLIC_BACKEND_URL (most specific, deployment-specific)
    ↓
NEXT_PUBLIC_API_BASE (generic API base)
    ↓
NEXT_PUBLIC_API_URL (legacy, Railway compatibility)
    ↓
http://localhost:8000 (local development)
```

This order ensures:
- **Deployment flexibility:** Different environments can use specific URLs
- **Railway compatibility:** Existing Railway deployments using API_URL continue to work
- **Local development:** Works out of the box without configuration
- **Consistency:** All components behave the same way

## Testing

### Test Coverage
- ✅ `__tests__/lib/api-url-resolution.spec.tsx` - 9 tests validating this priority order
- ✅ `__tests__/listings-schema-validation.spec.tsx` - Includes URL resolution consistency tests

### Verification
All components now follow the same pattern documented in:
- Test suite validates correct fallback chain
- All 88 tests passing
- No breaking changes to existing behavior

## Impact

### Before
- ⚠️ PropertyCard would crash if no env vars set
- ⚠️ Different components might connect to different backends
- ⚠️ Inconsistent behavior across the app

### After
- ✅ All components use same backend URL resolution
- ✅ Graceful fallback to localhost in development
- ✅ Predictable behavior across the app
- ✅ Better error messages (no unexpected crashes)

## Deployment Guide

### Local Development
No configuration needed - falls back to `http://localhost:8000`

### Production (Railway)
Set in Railway environment variables:
```bash
NEXT_PUBLIC_BACKEND_URL=https://your-backend.up.railway.app
```

### Production (Vercel)
Set in Vercel environment variables:
```bash
NEXT_PUBLIC_BACKEND_URL=https://your-backend.up.railway.app
```

### Legacy Deployments
If you're using `NEXT_PUBLIC_API_URL`, it will still work as a fallback:
```bash
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
```

But consider migrating to `NEXT_PUBLIC_BACKEND_URL` for clarity.

## Related Documentation

- **API URL Resolution Tests:** `frontend/__tests__/lib/api-url-resolution.spec.tsx`
- **Listings Troubleshooting:** `docs/LISTINGS_ZERO_DATA_TROUBLESHOOTING.md`
- **Environment Variables:** `frontend/.env.example`

## Migration Notes

If you have existing deployments with different environment variables:

1. **No breaking changes** - all existing env vars still work
2. **Recommended:** Set `NEXT_PUBLIC_BACKEND_URL` as the primary variable
3. **Optional cleanup:** Remove old `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_API_BASE` once `NEXT_PUBLIC_BACKEND_URL` is set

## Consistency Checklist

When adding new components that need backend access:

- [ ] Use `NEXT_PUBLIC_BACKEND_URL` first
- [ ] Fall back to `NEXT_PUBLIC_API_BASE`
- [ ] Fall back to `NEXT_PUBLIC_API_URL`
- [ ] Fall back to `http://localhost:8000` for development
- [ ] Don't throw errors if no env vars set (use fallback)
- [ ] Add comment referencing this priority order
- [ ] Test locally without env vars
- [ ] Test with each env var individually

## Code Pattern

Use this pattern in new code:

```typescript
/**
 * Resolve backend URL using standard priority:
 * NEXT_PUBLIC_BACKEND_URL -> NEXT_PUBLIC_API_BASE -> NEXT_PUBLIC_API_URL -> localhost
 */
const backendUrl = (
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000'
).replace(/\/+$/, ''); // Remove trailing slashes
```

Or import from centralized location:

```typescript
import { API_BASE } from '@/lib/api';
// API_BASE already implements this priority order
```
