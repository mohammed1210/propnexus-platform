# Feature Flags Documentation

This document describes the feature flags available in PropNexus Platform (Sprint 11+).

## Overview

Feature flags are centralized in `frontend/lib/flags.ts` to ensure consistent behavior across the application. All flags default to `false` when the environment variable is not set, providing fail-safe defaults.

### Centralized Flag Management

All feature flag logic is implemented in a single location (`frontend/lib/flags.ts`), which provides:

- **Consistent behavior**: All components use the same flag evaluation logic
- **Safe defaults**: Flags default to `false` when environment variables are missing
- **Type safety**: TypeScript ensures proper usage of flags

**Important:** Never use `process.env.NEXT_PUBLIC_FEATURE_*` directly in components. Always import and use flags from `lib/flags.ts`.

```typescript
// ✅ Correct - use centralized flags
import { FF } from '@/lib/flags';
if (FF.AI_CHAT) { /* ... */ }

// ❌ Wrong - direct environment variable access
if (process.env.NEXT_PUBLIC_FEATURE_AI_CHATBOT === 'true') { /* ... */ }
```

## Frontend Feature Flags

All frontend feature flags are environment variables prefixed with `NEXT_PUBLIC_FEATURE_` and should be set in `frontend/.env.local` or deployment environment.

### NEXT_PUBLIC_FEATURE_AI_CHATBOT

**Default:** `false`
**Description:** Enables the floating AI chatbot assistant on property detail pages.

When enabled:
- Shows a floating "Ask AI" button in the bottom-right corner
- Opens an interactive chat modal when clicked
- Sends user messages to `/gpt/chat` endpoint with property context
- Persists conversation history in localStorage (last 60 messages)
- Falls back to local responses if backend is unavailable

**Usage:**
```bash
NEXT_PUBLIC_FEATURE_AI_CHATBOT=true
```

**Requirements:**
- Backend `OPENAI_API_KEY` must be set for GPT responses
- Without API key, chatbot uses rule-based local responses

---

### NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE

**Default:** `false`
**Description:** Enables the AI Deal Score card on property detail pages.

When enabled:
- Displays an overall score (0-100) for the investment opportunity
- Shows category breakdown with progress bars:
  - Rental Yield (max 20 points)
  - ROI Potential (max 20 points)
  - Price-to-Rent Ratio (max 15 points)
  - Area Demand (max 15 points)
  - Safety Index (max 15 points)
  - Schools Access (max 15 points)
- Provides "Why this score?" button for GPT-powered explanation

**Usage:**
```bash
NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE=true
```

**Requirements:**
- `/gpt/score` endpoint (deterministic, no API key required)
- `/gpt/score/explain` endpoint (requires `OPENAI_API_KEY` for detailed explanation)

**Sprint 11.3 Update - Gated Panel Behavior:**
When disabled or plan insufficient, the AI Deal Score panel shows:
- Blurred/minimized preview of content (~140px height)
- "Locked" overlay with upgrade CTA
- No API calls made to `/gpt/score` or `/gpt/score/explain`
- Links to "/pricing" and "/account" for upgrading

---

### NEXT_PUBLIC_FEATURE_AREA_INTEL

**Default:** `false`
**Description:** Enables the Area Intelligence panel on property detail pages.

When enabled:
- Displays key area metrics:
  - Population
  - Average property price
  - Average monthly rent
  - Rental yield percentage
  - Crime index (0-100)
  - Schools rating (0-5.0)
  - Transport links
- Shows data source indicator (Live/Cached)
- Data is cached for 24 hours

**Usage:**
```bash
NEXT_PUBLIC_FEATURE_AREA_INTEL=true
```

**Requirements:**
- `/area-intel/{key}` endpoint
- Supabase `area_intel_cache` table for caching

**Sprint 11.3 Update - Gated Panel Behavior:**
When disabled or plan insufficient:
- Shows blurred/minimized preview of area data
- "Locked" overlay with lock icon and upgrade message
- No API call made to `/area-intel/{key}`
- Upgrade CTAs link to pricing and account pages

---

### NEXT_PUBLIC_FEATURE_COMPS

**Default:** `false`
**Description:** Enables the Comparable Sales & Rentals panel on property detail pages.

When enabled:
- Shows recent sales and rental listings in the area
- Displays summary statistics (avg sale price, avg rent)
- Lists up to 3 recent sales and 3 recent rentals with details:
  - Address
  - Price
  - Date
  - Property type
  - Distance (km)
- Shows data source indicator (Live/Cached)
- Data is cached for 24 hours

**Usage:**
```bash
NEXT_PUBLIC_FEATURE_COMPS=true
```

**Requirements:**
- `/comps/{postcode}` endpoint
- Supabase `comps_cache` table for caching

**Sprint 11.3 Update - Gated Panel Behavior:**
When disabled or plan insufficient:
- Displays blurred preview of comparable sales data
- "Locked" overlay prevents interaction
- No API call made to `/comps/{postcode}`
- Shows upgrade options for accessing feature

---

## Backend Configuration

### Subscription Plans

**Available Tiers:** `free`, `pro`, `investor`
**Location:** `backend/.env` and Stripe configuration

PropNexus Platform supports three subscription tiers:

1. **free** - Default tier for all users
   - Access to basic property listings
   - Basic calculators and tools
   - Limited feature access

2. **pro** - Professional investor tier
   - All free features
   - Advanced analytics
   - Priority support
   - Configurable via `STRIPE_PRICE_PRO` environment variable

3. **investor** - Premium investor tier
   - All pro features
   - Advanced AI features (when enabled)
   - Unlimited saved deals
   - Premium support
   - Configurable via `STRIPE_PRICE_INVESTOR` environment variable

**Note:** The `enterprise` tier has been removed in Sprint 11.2. The database constraint only allows `free`, `pro`, or `investor` values.

---

### OPENAI_API_KEY

**Required for:** AI Chatbot (GPT responses), Deal Score Explanation
**Type:** Secret (never expose on client)
**Location:** `backend/.env`

```bash
OPENAI_API_KEY=sk-...your-key-here...
```

**Note:** The `/gpt/score` endpoint works without this key (deterministic scoring), but `/gpt/chat` and `/gpt/score/explain` require it for GPT-powered responses.

---

### CACHE_TTL_SECONDS

**Default:** `1800` (30 minutes)
**Description:** Time-to-live for cached area intelligence and comparable sales data.
**Type:** Configuration
**Location:** `backend/.env`

```bash
CACHE_TTL_SECONDS=1800
```

**Note:** Longer TTL reduces API costs but may show stale data. Recommended range: 900-3600 seconds.

---

## Testing Feature Flags Locally

1. Copy the example environment file:
   ```bash
   cd frontend
   cp .env.example .env.local
   ```

2. Enable all Sprint 11 features:
   ```bash
   NEXT_PUBLIC_FEATURE_AI_CHATBOT=true
   NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE=true
   NEXT_PUBLIC_FEATURE_AREA_INTEL=true
   NEXT_PUBLIC_FEATURE_COMPS=true
   ```

3. Set backend API base:
   ```bash
   NEXT_PUBLIC_API_BASE=http://localhost:8000
   ```

4. Start the frontend:
   ```bash
   npm run dev
   ```

5. Navigate to any property detail page to see the new features.

---

## Deployment

### Vercel Deployment

Set environment variables in Vercel project settings:
- Go to Project Settings → Environment Variables
- Add each `NEXT_PUBLIC_FEATURE_*` variable
- Set to `true` to enable, `false` or omit to disable

### Backend (Railway/Heroku)

Set environment variables in your backend hosting platform:
- `OPENAI_API_KEY` (required for GPT features)
- `CACHE_TTL_SECONDS` (optional, defaults to 1800)

---

## Rollout Strategy

**Phase 1: Internal Testing**
- Enable all flags in staging environment
- Test with real property data
- Verify caching behavior

**Phase 2: Soft Launch**
- Enable AI Deal Score for all users (no API cost)
- Enable Area Intel and Comps for all users (cached data)
- Keep AI Chatbot disabled (GPT API costs)

**Phase 3: Full Launch**
- Enable AI Chatbot for Pro/Investor tier only
- Monitor API usage and costs
- Adjust rate limits as needed

---

## Troubleshooting

**Chatbot shows "AI service not configured" error:**
- Backend `OPENAI_API_KEY` is not set
- Chatbot will fall back to local rule-based responses

**Deal Score shows "Score unavailable":**
- `/gpt/score` endpoint is not responding
- Check backend logs for errors

**Area Intel or Comps show "unavailable":**
- Data provider is down
- Check backend logs for provider errors
- Data should be served from cache if available

**Changes not appearing:**
- Rebuild frontend after changing environment variables
- Clear browser cache and localStorage
- Verify environment variables are set correctly in deployment

---

## Version History

- **v11.2.0** (Sprint 11.2):
  - Limited subscription plans to free, pro, investor (removed enterprise tier)
  - Refined feature flag enforcement for AI panels
  - Updated Stripe webhook to only map pro and investor price IDs
- **v11.1.0** (Sprint 11 Polish):
  - Centralized feature flag enforcement in `lib/flags.ts`
  - Removed direct `process.env` access from components
  - Added token-based authentication for `/users/plan` endpoint
  - Updated `.env.example` with consistent flag naming
- **v11.0.0** (Sprint 11): Initial release of all four feature flags
