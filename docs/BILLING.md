# Billing and Subscription Architecture

## Overview

This document describes the complete billing and subscription flow in PropNexus, from Stripe checkout to frontend plan display.

Last updated: 2025-11-22

## System Components

### Frontend
- **Pricing Page** (`/pricing`): Displays subscription tiers with UpgradeButton components
- **Account Page** (`/account`): Shows current plan, manages subscriptions via Stripe portal
- **useUserPlan Hook** (`lib/useUserPlan.ts`): Fetches and caches user plan from backend

### Backend
- **Stripe Webhook** (`routes/stripe_webhook.py`): Handles Stripe events and updates users table
- **Users Routes** (`routes/users_routes.py`): Provides `/users/plan` endpoint for plan queries
- **Stripe Routes** (`routes/stripe_routes.py`): Creates checkout sessions and portal sessions

### Database
- **users Table**: Single source of truth for user plans
  - `plan`: 'free' | 'pro' | 'investor'
  - `plan_status`: 'active' | 'trialing' | 'past_due' | 'canceled'
  - `current_period_end`: Unix timestamp
  - `stripe_customer_id`: Stripe customer ID

## Subscription Flow

### 1. User Initiates Upgrade

```
User clicks "Start 7-Day Free Trial" on /pricing
    ↓
Frontend: UpgradeButton → POST /api/stripe/checkout
    ↓
Next.js API Route proxies to Backend: POST /stripe/create-checkout-session
    ↓
Backend creates Stripe Checkout Session with:
    - price_id (STRIPE_PRICE_PRO or STRIPE_PRICE_INVESTOR)
    - customer_email from Clerk
    - success_url: /account?success=true&session_id={CHECKOUT_SESSION_ID}
    - cancel_url: /pricing
    - subscription_data.trial_period_days: 7
    ↓
Returns checkout URL
    ↓
Frontend redirects to Stripe Checkout
```

### 2. User Completes Payment

```
User enters payment details on Stripe
    ↓
Stripe processes payment (or starts trial)
    ↓
Stripe redirects to success_url: /account?success=true&session_id=...
```

### 3. Webhook Processing

**Event: `checkout.session.completed`**

```
Stripe sends webhook to Backend: POST /stripe/webhook
    ↓
Backend verifies webhook signature
    ↓
Backend extracts:
    - customer_id
    - customer_email
    - subscription_id
    ↓
Backend retrieves subscription details:
    - status (active, trialing, etc.)
    - price_id
    - current_period_end
    ↓
Backend maps price_id to plan:
    - STRIPE_PRICE_PRO → 'pro'
    - STRIPE_PRICE_INVESTOR → 'investor'
    - unknown → null (preserves existing plan)
    ↓
Backend upserts users table:
    UPDATE users SET
        stripe_customer_id = '...',
        plan = 'pro',
        plan_status = 'trialing',
        current_period_end = 1234567890
    WHERE email = 'user@example.com'
    ↓
Returns HTTP 200
```

**Event: `customer.subscription.updated`**

```
Stripe sends webhook when subscription changes
    ↓
Backend updates users table with new status/period_end
    ↓
If status changes to 'canceled', preserves plan until period_end
```

**Event: `customer.subscription.deleted`**

```
Stripe sends webhook when subscription ends
    ↓
Backend downgrades user:
    UPDATE users SET
        plan = 'free',
        plan_status = 'canceled',
        current_period_end = NULL
```

### 4. Frontend Plan Update

```
User lands on /account?success=true&session_id=...
    ↓
AccountPage detects success param
    ↓
Waits 2 seconds for webhook processing
    ↓
Calls useUserPlan.refetch()
    ↓
Frontend: GET ${BACKEND_URL}/users/plan?email=user@example.com
    ↓
Backend: SELECT plan, stripe_customer_id FROM users WHERE email = '...'
    ↓
Returns: { plan: 'pro', stripe_customer_id: 'cus_...' }
    ↓
Frontend updates UI with new plan badge
```

## Configuration

### Trial Period

Trials are configured in two places:

1. **Backend Checkout Session** (`routes/stripe_routes.py`):
   ```python
   session = stripe.checkout.Session.create(
       subscription_data={
           "trial_period_days": 7
       }
   )
   ```

2. **Stripe Dashboard** (optional):
   - Price Settings → Trial period
   - If both configured, checkout session takes precedence

### Price Mapping

Environment variables map Stripe price IDs to plan tiers:

**Backend** (`.env`):
```env
STRIPE_PRICE_PRO=price_1SKIBTRvsQUM0wWd1P0WWjCz
STRIPE_PRICE_INVESTOR=price_1SNDCSRvsQUM0wWd5c5RaJiA
```

**Frontend** (`.env.local`):
```env
NEXT_PUBLIC_STRIPE_PRICE_PRO=price_1SKIBTRvsQUM0wWd1P0WWjCz
NEXT_PUBLIC_STRIPE_PRICE_INVESTOR=price_1SNDCSRvsQUM0wWd5c5RaJiA
```

## Error Handling

### Unknown Price IDs

If webhook receives an unknown price_id:
- Backend does NOT downgrade to 'free'
- Preserves existing plan
- Updates plan_status and current_period_end only
- Logs warning

### Missing Stripe Customer

If user exists in Supabase but no stripe_customer_id:
- Webhook creates customer_id on first subscription
- Email is used as fallback lookup

### Webhook Failures

Backend webhook handler:
- Returns HTTP 200 even on graceful failures
- Logs errors but doesn't block Stripe
- Upsert failures are logged, not thrown

## Testing

### Manual Testing Checklist

1. **Free User**
   - [ ] Sign up with Clerk
   - [ ] Verify plan badge shows "Free"
   - [ ] Verify users table: plan='free'

2. **Pro Upgrade**
   - [ ] Click "Start 7-Day Free Trial" on Pro tier
   - [ ] Complete Stripe checkout
   - [ ] Verify redirected to /account?success=true
   - [ ] Verify plan badge updates to "Pro (trial)"
   - [ ] Verify users table: plan='pro', plan_status='trialing'

3. **Investor Upgrade**
   - [ ] Same as Pro but for Investor tier
   - [ ] Verify plan badge shows "Investor (trial)"

4. **Subscription Cancellation**
   - [ ] Open Stripe Customer Portal
   - [ ] Cancel subscription
   - [ ] Verify plan remains until period_end
   - [ ] After period_end, verify downgrade to "Free"

### Automated Tests

**Stripe Webhook Tests** (`backend/tests/test_stripe_webhook.py`):
- ✅ 13 tests covering all webhook events
- ✅ Pro and Investor subscription creation
- ✅ Subscription updates and cancellations
- ✅ Email retrieval fallbacks

**Properties Routes Tests** (`backend/tests/test_properties_routes.py`):
- ✅ 6 tests for properties endpoint
- ✅ Filters, sorting, and single property fetch

Run tests:
```bash
cd backend
PYTHONPATH=/path/to/repo python3 -m pytest tests/ -v
```

## Troubleshooting

### Plan Not Updating After Checkout

**Symptoms**: User completes checkout but plan still shows "Free"

**Causes**:
1. Webhook not firing (check Stripe dashboard → Webhooks → Logs)
2. Webhook signature mismatch (check STRIPE_WEBHOOK_SECRET)
3. Database upsert failure (check backend logs)
4. Frontend not refetching (check browser console)

**Solutions**:
1. Manually trigger webhook from Stripe dashboard
2. Verify STRIPE_WEBHOOK_SECRET matches Stripe dashboard
3. Check backend logs for "Failed to upsert user data"
4. Check that useUserPlan.refetch() is called on account page

### Wrong Plan Tier

**Symptoms**: User subscribed to Pro but shows Investor (or vice versa)

**Causes**:
1. Price ID mapping incorrect
2. Wrong price_id used in checkout

**Solutions**:
1. Verify environment variables match Stripe dashboard
2. Check webhook logs for price_id received
3. Manually update users table if needed:
   ```sql
   UPDATE users SET plan = 'pro' WHERE email = 'user@example.com';
   ```

### Trial Not Showing

**Symptoms**: plan_status is 'active' instead of 'trialing'

**Causes**:
1. Trial not configured in checkout session
2. Trial already used by this customer

**Solutions**:
1. Check subscription_data.trial_period_days in backend
2. Stripe only allows one trial per customer (by design)

## Migration Notes

### From Direct Supabase to Backend API

**Before**: Frontend queried Supabase directly
**After**: Frontend calls backend `/properties` endpoint

**Migration Steps**:
1. ✅ Backend properties_routes.py enhanced with all filters
2. ✅ Frontend listings page updated to fetch from backend
3. ✅ getSupabase import removed from listings page
4. ✅ Tests added for properties endpoint

**Benefits**:
- Centralized authentication and authorization
- Rate limiting and caching at backend layer
- Better monitoring and observability
- Reduced client-side dependencies

## See Also

- [Clerk Authentication](./clerk-auth-integration.md)
- [Clerk Webhook Setup](./clerk-webhook-setup-guide.md)
- [Testing Plan](./auth-subscription-testing-plan.md)
- [Supabase Schema](../supabase/SCHEMA_UPDATES.md)
