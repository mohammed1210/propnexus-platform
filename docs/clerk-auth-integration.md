# Clerk Authentication Integration

This document explains how PropNexus uses Clerk for authentication and connects it with Stripe subscriptions.

## Overview

PropNexus now uses **Clerk** as the primary authentication provider, replacing the previous Supabase magic link authentication. User data is synced to Supabase for subscription and billing management.

## Architecture

```
┌─────────────┐      Sign Up/In      ┌───────────────┐
│   User      │ ──────────────────> │    Clerk      │
└─────────────┘                      └───────┬───────┘
                                             │
                                             │ Webhook
                                             ▼
                                     ┌───────────────┐
                                     │  Next.js API  │
                                     │   /webhooks   │
                                     │    /clerk     │
                                     └───────┬───────┘
                                             │
                                             │ Create User
                                             ▼
                                     ┌───────────────┐
                                     │   Supabase    │
                                     │  users table  │
                                     └───────────────┘
```

## Setup Instructions

### 1. Clerk Configuration

1. **Create a Clerk Application**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com)
   - Create a new application or use existing one
   - Copy your publishable and secret keys

2. **Configure Environment Variables**
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
   CLERK_SECRET_KEY=sk_live_xxx
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/account
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/account
   ```

3. **Set Up Clerk Webhook**
   - In Clerk Dashboard, go to Webhooks
   - Click "Add Endpoint"
   - Endpoint URL: `https://your-domain.vercel.app/api/webhooks/clerk`
   - Subscribe to events:
     - `user.created`
     - `user.updated`
   - Copy the webhook secret
   - Add to environment: `CLERK_WEBHOOK_SECRET=whsec_xxx`

### 2. Supabase Configuration

Ensure your Supabase users table has the following structure:

```sql
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  plan text default 'free',
  stripe_customer_id text unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
```

### 3. Deployment

1. **Vercel Environment Variables**
   - Add all Clerk environment variables
   - Include `CLERK_WEBHOOK_SECRET`
   - Ensure Supabase credentials are set

2. **Webhook Endpoint**
   - After deploying, verify webhook endpoint is accessible
   - Test webhook delivery in Clerk Dashboard
   - Check Vercel function logs for webhook processing

## How It Works

### User Sign Up Flow

1. User clicks "Sign Up" on the site
2. Clerk handles authentication (email/password, OAuth, etc.)
3. Clerk sends `user.created` webhook to `/api/webhooks/clerk`
4. Webhook handler:
   - Extracts user email from Clerk event
   - Checks if user exists in Supabase
   - Creates new user record with `plan: 'free'`
5. User is redirected to account page

### Subscription Flow

1. User navigates to `/pricing`
2. Clicks "Start 7-Day Free Trial" on Pro or Investor plan
3. `UpgradeButton` component:
   - Gets user email from Clerk via `useUser()` hook
   - Calls `/api/stripe/checkout` with email and price ID
   - Redirects to Stripe Checkout
4. After successful payment:
   - Stripe sends webhook to backend `/stripe/webhook`
   - Backend updates user's `plan` field in Supabase
   - User is redirected back with success message
5. Plan changes are reflected immediately via `useUserPlan()` hook

### Feature Gating

Components use the `useUserPlan()` hook to check user subscription:

```tsx
import { useUserPlan } from '@/lib/useUserPlan';

function MyComponent() {
  const { plan, loading } = useUserPlan();

  if (loading) return <div>Loading...</div>;

  if (plan === 'free') {
    return <UpgradePrompt />;
  }

  return <PremiumFeature />;
}
```

Or use the `PlanGate` component:

```tsx
<PlanGate require="investor">
  <AdvancedAnalytics />
</PlanGate>
```

## Components Updated

### `useUserPlan` Hook
- Now uses `useUser()` from Clerk instead of Supabase auth
- Fetches plan from backend using email query parameter
- Automatically refreshes when Clerk user state changes

### `UpgradeButton` Component
- Uses `useUser()` to get current user and email
- Redirects to `/sign-in` if not authenticated
- Works seamlessly with Clerk authentication

### `AccountPage`
- Displays Clerk user information
- Removed Supabase sign-out functionality
- Uses Clerk's `UserButton` for account management

## Migration from Supabase Auth

If you have existing users with Supabase magic link authentication:

1. **Keep Existing Users**: Users in the Supabase `users` table are preserved
2. **New Sign-ups**: New users sign up through Clerk
3. **Gradual Migration**: Existing users can continue using their accounts
4. **Data Integrity**: The webhook ensures all Clerk users are synced to Supabase

## Testing

### Test User Creation

1. Sign up with a new email through Clerk
2. Check Vercel function logs for webhook processing
3. Verify user created in Supabase `users` table with `plan: 'free'`

### Test Subscription Upgrade

1. Sign in with test user
2. Navigate to `/pricing`
3. Click "Start 7-Day Free Trial"
4. Complete Stripe checkout (use test card: 4242 4242 4242 4242)
5. Verify plan updated in Supabase
6. Check that features are unlocked

### Test Feature Gating

1. Sign in as free user
2. Try to access investor-only features
3. Should see upgrade prompt
4. After upgrading, features should be accessible

## Troubleshooting

### Webhook Not Firing

- Check Clerk Dashboard → Webhooks → Attempts
- Verify endpoint URL is correct
- Ensure `CLERK_WEBHOOK_SECRET` is set in Vercel
- Check Vercel function logs for errors

### User Not Created in Supabase

- Verify Supabase credentials in environment variables
- Check webhook logs for database errors
- Ensure `users` table exists with correct schema
- Verify email is present in Clerk user event

### Plan Not Updating After Subscription

- Check Stripe webhook is configured correctly
- Verify backend `/stripe/webhook` is receiving events
- Ensure price IDs match in environment variables
- Check backend logs for processing errors

### Authentication Loops

- Clear browser cookies and cache
- Verify Clerk redirect URLs are correct
- Check that sign-in/sign-up pages are accessible
- Ensure middleware is not blocking auth routes

## Security Considerations

1. **Webhook Verification**: All webhooks are verified using Svix signature verification
2. **Service Role Key**: Supabase service role key is only used server-side
3. **Email Validation**: User emails are validated before database insertion
4. **Idempotency**: Webhook handler checks for existing users to prevent duplicates

## Future Enhancements

- [ ] Bulk migrate existing Supabase auth users to Clerk
- [ ] Add social OAuth providers (Google, GitHub)
- [ ] Implement user metadata sync (name, avatar)
- [ ] Add webhook retry logic for failed database operations
- [ ] Create admin dashboard for user management
