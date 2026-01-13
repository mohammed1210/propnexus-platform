"use client";

// frontend/lib/useUserPlan.ts
import { useEffect, useState, useCallback } from 'react';

export type UserPlan = 'free' | 'pro' | 'investor';

type ClerkUser = {
  primaryEmailAddress?: { emailAddress?: string };
  emailAddresses?: Array<{ emailAddress?: string }>;
};

function hasValidClerkKey(key?: string) {
  if (!key) return false;
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase().includes('your_') || trimmed.toLowerCase().includes('placeholder')) return false;
  return true;
}

function isClerkEnabled() {
  return hasValidClerkKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

function getClerkUserEmail(user?: ClerkUser | null): string | null {
  const primary = user?.primaryEmailAddress?.emailAddress;
  if (primary) return primary;
  const fallback = user?.emailAddresses?.[0]?.emailAddress;
  return fallback || null;
}

export interface UserPlanData {
  plan: UserPlan;
  stripe_customer_id: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch and track the current user's subscription plan.
 *
 * Now uses Clerk for authentication:
 * 1. Gets the authenticated user from Clerk
 * 2. Fetches plan details from backend /users/plan endpoint using user email
 * 3. Returns plan, stripe_customer_id, loading state, error, and refetch function
 *
 * Usage:
 *   const { plan, loading, error, refetch } = useUserPlan();
 *   if (loading) return <div>Loading...</div>;
 *   if (plan === 'investor') return <InvestorContent />;
 *
 * After subscription upgrade:
 *   await refetch(); // Manually refresh plan data
 */
export function useUserPlan(): UserPlanData {
  const [plan, setPlan] = useState<UserPlan>('free');
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // If Clerk isn't enabled, never touch Clerk at all.
      if (!isClerkEnabled()) {
        setPlan('free');
        setStripeCustomerId(null);
        setLoading(false);
        return;
      }

      // Clerk enabled, but provider/scripts might not be mounted (during build/prerender).
      if (typeof window === 'undefined') {
        setPlan('free');
        setStripeCustomerId(null);
        setLoading(false);
        return;
      }

      const clerk = (window as any).Clerk as
        | undefined
        | {
            loaded?: boolean;
            user?: ClerkUser | null;
            session?: unknown;
            load?: () => Promise<void>;
          };

      if (!clerk) {
        setPlan('free');
        setStripeCustomerId(null);
        setLoading(false);
        return;
      }

      if (typeof clerk.load === 'function' && !clerk.loaded) {
        try {
          await clerk.load();
        } catch {
          // If Clerk can't load for any reason, stay safe.
          setPlan('free');
          setStripeCustomerId(null);
          setLoading(false);
          return;
        }
      }

      const user = clerk.user;
      if (!user) {
        setPlan('free');
        setStripeCustomerId(null);
        setLoading(false);
        return;
      }

      const email = getClerkUserEmail(user);
      if (!email) {
        console.warn('[useUserPlan] No email found for user');
        setPlan('free');
        setStripeCustomerId(null);
        setLoading(false);
        return;
      }

      // Fetch plan from backend using email query parameter
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
      const response = await fetch(
        `${backendUrl}/users/plan?email=${encodeURIComponent(email)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // Bypass cache to ensure fresh data
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch plan: ${response.status}`);
      }

      const data = await response.json();

      setPlan((data.plan as UserPlan) || 'free');
      setStripeCustomerId(data.stripe_customer_id || null);
      setLoading(false);
    } catch (err: any) {
      console.error('[useUserPlan] Error:', err);
      setError(err.message || 'Failed to fetch user plan');
      setPlan('free'); // Fallback to free on error
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    setRefreshTrigger((prev) => prev + 1);
    await fetchPlan();
  }, [fetchPlan]);

  useEffect(() => {
    (async () => {
      await fetchPlan();
    })();
  }, [refreshTrigger, fetchPlan]);

  return {
    plan,
    stripe_customer_id: stripeCustomerId,
    loading,
    error,
    refetch,
  };
}
