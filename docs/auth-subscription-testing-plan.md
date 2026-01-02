# Authentication and Subscription Testing Plan

This document outlines the comprehensive testing procedure for the Clerk authentication integration and subscription gating system.

## Prerequisites

Before testing, ensure the following are configured:

### Environment Variables (Frontend)
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PRICE_PRO=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_INVESTOR=price_xxx
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

### Environment Variables (Backend)
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_INVESTOR=price_xxx
```

### Clerk Webhook Setup
1. Clerk Dashboard → Webhooks
2. Add endpoint: `https://your-domain.vercel.app/api/webhooks/clerk`
3. Subscribe to: `user.created`, `user.updated`
4. Copy webhook secret to environment

### Stripe Webhook Setup
1. Stripe Dashboard → Webhooks
2. Backend endpoint: `https://your-backend.railway.app/stripe/webhook`
3. Events: `checkout.session.completed`, `customer.subscription.*`

## Test Suite

### 1. User Sign-Up Flow

**Objective**: Verify new users can sign up with Clerk and are created in Supabase with free plan.

**Steps**:
1. Navigate to `/sign-up`
2. Enter a new email address
3. Complete Clerk sign-up process (verify email if required)
4. After sign-up, check redirected to account page

**Expected Results**:
- ✅ User successfully signs up
- ✅ Clerk webhook fires to `/api/webhooks/clerk`
- ✅ User created in Supabase `users` table with:
  - Email matches Clerk email
  - `plan` = 'free'
  - `created_at` and `updated_at` timestamps set
- ✅ Redirected to `/account` page

**Validation Queries**:
```sql
-- Check user was created
SELECT * FROM users WHERE email = 'test@example.com';

-- Should return: plan = 'free', stripe_customer_id = NULL
```

**Logs to Check**:
- Vercel function logs for `/api/webhooks/clerk`
- Should see: `[Clerk Webhook] User created successfully: test@example.com`

---

### 2. User Sign-In Flow

**Objective**: Verify existing users can sign in with Clerk.

**Steps**:
1. Navigate to `/sign-in`
2. Enter existing user credentials
3. Complete Clerk sign-in process
4. After sign-in, verify redirected appropriately

**Expected Results**:
- ✅ User successfully signs in
- ✅ User Button appears in header
- ✅ Can navigate to `/account` page
- ✅ Account page shows correct email and plan badge

---

### 3. Plan Detection

**Objective**: Verify `useUserPlan` hook correctly fetches user plan.

**Steps**:
1. Sign in as a free user
2. Navigate to pages with plan detection:
   - `/account` - should show plan badge
   - Any page with gated content
3. Check browser console for `useUserPlan` logs

**Expected Results**:
- ✅ `useUserPlan` hook fetches plan from backend
- ✅ Backend `/users/plan` endpoint called with email parameter
- ✅ Plan correctly identified as 'free'
- ✅ PlanBadge component shows "Free" tier

**Browser Console Check**:
```javascript
// No errors related to useUserPlan
// Can check Network tab for /users/plan API call
```

---

### 4. Free Tier Gating

**Objective**: Verify gated features are locked for free users.

**Steps**:
1. Sign in as free user
2. Navigate to pages with gated content
3. Try to access investor-only features
4. Observe gating components

**Expected Results**:
- ✅ `PlanGate` component shows upgrade prompt for investor features
- ✅ `LockedFeature` component displays lock icon and message
- ✅ Content is blurred/hidden behind gate
- ✅ "View Pricing" and "Manage Plan" buttons visible

**Components to Test**:
- Any page using `<PlanGate require="investor">`
- Any feature wrapped in `<LockedFeature>`
- Features checking `plan` with `useUserPlan()`

---

### 5. Upgrade to Pro Plan

**Objective**: Verify users can upgrade from free to pro plan.

**Steps**:
1. Sign in as free user
2. Navigate to `/pricing`
3. Click "Start 7-Day Free Trial" on Pro plan card
4. Should redirect to Stripe Checkout
5. Complete checkout with test card: `4242 4242 4242 4242`
6. After payment, redirect back to site
7. Wait 5 seconds for webhook processing

**Expected Results**:
- ✅ Redirected to Stripe Checkout
- ✅ Checkout session includes 7-day trial
- ✅ After payment, redirected to `/account?success=true&session_id=xxx`
- ✅ Success toast appears: "Subscription updated successfully!"
- ✅ After webhook processing, second toast: "Your plan has been updated!"
- ✅ PlanBadge updates to "Pro"

**Validation Queries**:
```sql
-- Check plan updated
SELECT plan, stripe_customer_id, updated_at
FROM users
WHERE email = 'test@example.com';

-- Should return: plan = 'pro', stripe_customer_id = 'cus_xxx'
```

**Stripe Dashboard Check**:
- Customer created with email
- Subscription active with 7-day trial
- Price ID matches `STRIPE_PRICE_PRO`

**Logs to Check**:
- Backend logs: `[stripe_webhook] Updated user plan to pro`
- Webhook delivery successful in Stripe Dashboard

---

### 6. Pro Plan Feature Access

**Objective**: Verify pro users can access pro-gated features.

**Steps**:
1. Remain signed in as pro user (from test 5)
2. Navigate to pages with pro-gated content
3. Try to access features that require pro plan
4. Verify no upgrade prompts appear for pro content

**Expected Results**:
- ✅ Pro features are accessible (not gated)
- ✅ `<PlanGate require="pro">` allows access
- ✅ No "Upgrade Required" messages for pro features
- ✅ Investor features still gated (show upgrade prompt)

---

### 7. Upgrade to Investor Plan

**Objective**: Verify users can upgrade from pro to investor plan.

**Steps**:
1. Sign in as pro user
2. Navigate to `/pricing`
3. Click "Start 7-Day Free Trial" on Investor plan card
4. Complete Stripe Checkout
5. Wait for webhook processing

**Expected Results**:
- ✅ Can upgrade from Pro to Investor
- ✅ Stripe creates new subscription or upgrades existing
- ✅ Plan updated to 'investor' in database
- ✅ PlanBadge shows "Investor"
- ✅ All features now accessible

**Validation Queries**:
```sql
-- Check plan updated to investor
SELECT plan, updated_at
FROM users
WHERE email = 'test@example.com';

-- Should return: plan = 'investor'
```

---

### 8. Investor Plan Full Access

**Objective**: Verify investor users can access all features.

**Steps**:
1. Remain signed in as investor user
2. Navigate to all pages with gated content
3. Verify no upgrade prompts appear
4. Test all investor-only features

**Expected Results**:
- ✅ All `<PlanGate>` components grant access
- ✅ All `<LockedFeature>` components show unlocked content
- ✅ No upgrade prompts anywhere
- ✅ Full feature access across the platform

---

### 9. Plan Persistence

**Objective**: Verify plan persists across sessions.

**Steps**:
1. Sign in as investor user
2. Note current plan
3. Sign out using User Button
4. Close browser/clear cookies (optional)
5. Sign in again with same account
6. Check plan is still investor

**Expected Results**:
- ✅ Plan persists in database
- ✅ After sign-in, plan immediately reflects as investor
- ✅ No delay in feature access
- ✅ PlanBadge shows correct tier immediately

---

### 10. Subscription Management

**Objective**: Verify users can manage subscriptions via Stripe portal.

**Steps**:
1. Sign in as paid user (pro or investor)
2. Navigate to `/account`
3. Click "Open Customer Portal" button
4. Should redirect to Stripe Customer Portal
5. In portal, update payment method or cancel subscription
6. Return to site

**Expected Results**:
- ✅ Customer Portal opens successfully
- ✅ Shows correct subscription details
- ✅ Can update payment method
- ✅ Can cancel subscription
- ✅ Cancellation webhook updates plan to 'free'

**Validation After Cancellation**:
```sql
-- Check plan reverted to free
SELECT plan, stripe_customer_id
FROM users
WHERE email = 'test@example.com';

-- Should return: plan = 'free', stripe_customer_id still set
```

---

### 11. Webhook Reliability

**Objective**: Test webhook delivery and error handling.

**Test Scenarios**:

#### A. Successful Webhook
1. Trigger Clerk user.created event (sign up new user)
2. Check Clerk Dashboard → Webhooks → Attempts
3. Verify delivery succeeded

**Expected**:
- ✅ Status: 200 OK
- ✅ Response body: `{"success": true, "action": "created"}`

#### B. Duplicate User
1. Manually create user in Supabase
2. Sign up with same email in Clerk
3. Check webhook response

**Expected**:
- ✅ Status: 200 OK
- ✅ Response body: `{"success": true, "action": "skip"}`
- ✅ No duplicate created

#### C. Stripe Webhook
1. Complete a purchase
2. Check Stripe Dashboard → Webhooks → Delivery attempts
3. Verify backend webhook received event

**Expected**:
- ✅ Backend logs show event processing
- ✅ User plan updated in database
- ✅ Webhook marked as delivered in Stripe

---

### 12. Error Handling

**Objective**: Test error scenarios and fallbacks.

**Test Scenarios**:

#### A. Backend API Down
1. Stop backend server
2. Sign in to frontend
3. Navigate to gated content

**Expected**:
- ✅ `useUserPlan` fails gracefully
- ✅ Defaults to 'free' plan
- ✅ Shows gating as expected
- ✅ No crash or blank page

#### B. Invalid Stripe Checkout
1. Manipulate price ID in request
2. Try to upgrade
3. Observe error handling

**Expected**:
- ✅ Error toast displayed
- ✅ User remains on pricing page
- ✅ No charge attempted

#### C. Missing Supabase Credentials
1. Remove Supabase URL from environment
2. Try to load app
3. Check for graceful degradation

**Expected**:
- ✅ App loads (doesn't crash)
- ✅ Warning in console
- ✅ Features may be limited but site accessible

---

## Automated Test Creation

### Unit Tests

Create tests for key functions:

```typescript
// tests/lib/useUserPlan.test.ts
describe('useUserPlan', () => {
  it('defaults to free when user not logged in', () => {
    // Mock no Clerk user
    // Assert plan === 'free'
  });

  it('fetches plan from backend for logged in user', async () => {
    // Mock Clerk user
    // Mock backend API response
    // Assert plan matches API response
  });

  it('handles API errors gracefully', async () => {
    // Mock API error
    // Assert defaults to 'free'
    // Assert error is logged
  });
});
```

### Integration Tests

Create E2E tests with Playwright:

```typescript
// e2e/auth-subscription.spec.ts
test.describe('Authentication and Subscription Flow', () => {
  test('complete upgrade flow from free to pro', async ({ page }) => {
    // 1. Sign up
    await page.goto('/sign-up');
    await page.fill('input[type="email"]', 'test@example.com');
    // ... complete sign-up

    // 2. Verify free tier
    await page.goto('/pricing');
    await expect(page.locator('text=Free')).toBeVisible();

    // 3. Click upgrade
    await page.click('text=Start 7-Day Free Trial');
    await page.waitForURL('**/checkout.stripe.com/**');

    // 4. Complete Stripe checkout (test mode)
    // ... fill card details

    // 5. Verify upgrade
    await page.waitForURL('**/account?success=true');
    await expect(page.locator('text=Pro')).toBeVisible();
  });
});
```

---

## Performance Testing

### Load Testing

Test webhook endpoints under load:

```bash
# Test Clerk webhook
ab -n 100 -c 10 \
  -p clerk-webhook-payload.json \
  -T 'application/json' \
  https://your-domain.vercel.app/api/webhooks/clerk

# Test Stripe webhook
ab -n 100 -c 10 \
  -p stripe-webhook-payload.json \
  -T 'application/json' \
  https://your-backend.railway.app/stripe/webhook
```

**Expected**:
- ✅ 100% success rate
- ✅ Average response time < 500ms
- ✅ No duplicate user creations
- ✅ All plan updates processed correctly

---

## Security Testing

### 1. Webhook Signature Verification

**Test**: Send unsigned webhook request

```bash
curl -X POST https://your-domain.vercel.app/api/webhooks/clerk \
  -H 'Content-Type: application/json' \
  -d '{"type":"user.created","data":{}}'
```

**Expected**:
- ✅ Returns 400 Bad Request
- ✅ Error: "Invalid signature"
- ✅ No user created in database

### 2. SQL Injection

**Test**: Try SQL injection in email field

```bash
curl -X GET 'https://your-backend/users/plan?email=test@example.com;DROP TABLE users;'
```

**Expected**:
- ✅ Request handled safely
- ✅ No database manipulation
- ✅ Returns error or empty result

### 3. Unauthorized Plan Changes

**Test**: Try to directly update plan without payment

```sql
-- Attempt direct update (should fail due to RLS)
UPDATE users SET plan = 'investor' WHERE email = 'test@example.com';
```

**Expected**:
- ✅ RLS policies prevent direct update
- ✅ Only webhook/service role can update
- ✅ User plan remains unchanged

---

## Regression Testing

After any code changes, run this quick smoke test:

1. ✅ Sign up new user → user created in DB
2. ✅ Sign in existing user → successful
3. ✅ View pricing page → loads correctly
4. ✅ Attempt upgrade → redirects to Stripe
5. ✅ Check gated content → shows appropriate gates
6. ✅ View account page → shows correct plan

---

## Monitoring and Alerts

### Metrics to Monitor

1. **Webhook Success Rate**
   - Clerk webhook delivery: > 99%
   - Stripe webhook delivery: > 99%

2. **API Response Times**
   - `/users/plan` endpoint: < 200ms avg
   - Webhook processing: < 1s

3. **Error Rates**
   - Clerk webhook errors: < 0.1%
   - Stripe checkout failures: < 1%
   - Plan fetch errors: < 0.5%

### Set Up Alerts

Configure alerts for:
- Webhook delivery failures (> 5 in 5 minutes)
- High error rates on `/users/plan` endpoint
- Stripe checkout failures (> 10% rate)
- Supabase database connection issues

---

## Troubleshooting Guide

### Issue: User created in Clerk but not in Supabase

**Diagnosis**:
1. Check Clerk Dashboard → Webhooks → Attempts
2. Look for delivery failures
3. Check Vercel function logs

**Solutions**:
- Verify webhook secret matches
- Check Supabase credentials in environment
- Manually trigger webhook retry in Clerk

### Issue: Plan not updating after payment

**Diagnosis**:
1. Check Stripe Dashboard → Webhooks → Delivery
2. Verify backend webhook received event
3. Check backend logs for processing errors

**Solutions**:
- Verify Stripe webhook secret matches
- Check price ID mappings in backend environment
- Ensure Supabase service role key is valid

### Issue: Gating not working (features always locked)

**Diagnosis**:
1. Check `useUserPlan` hook in browser console
2. Verify `/users/plan` API call succeeds
3. Check backend is running and accessible

**Solutions**:
- Verify backend URL in frontend environment
- Check CORS settings on backend
- Ensure user email exists in database

---

## Success Criteria

All tests pass when:
- ✅ 100% webhook delivery success rate
- ✅ 0 authentication errors
- ✅ Correct plan displayed for all users
- ✅ Gating works correctly for all tiers
- ✅ Upgrades process successfully
- ✅ No data inconsistencies in database
- ✅ No security vulnerabilities found
- ✅ Performance within acceptable limits

---

## Sign-Off Checklist

Before marking as complete:
- [ ] All 12 main test scenarios passed
- [ ] Automated tests created and passing
- [ ] Security tests passed
- [ ] Performance tests passed
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] Stakeholder sign-off obtained
