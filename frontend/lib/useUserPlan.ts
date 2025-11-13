// frontend/lib/useUserPlan.ts
import { useEffect, useState, useCallback } from 'react';
import { getSupabase } from './supabaseClient';

export type UserPlan = 'free' | 'pro' | 'investor';

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
 * 1. Gets the authenticated user session from Supabase auth
 * 2. Fetches plan details from backend /users/plan endpoint using JWT token
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

      // Get authenticated user session from Supabase
      const sb = getSupabase();
      const { data: sessionData, error: authError } = await sb.auth.getSession();

      if (authError) {
        throw new Error(`Auth error: ${authError.message}`);
      }

      const session = sessionData?.session;
      if (!session || !session.access_token) {
        // User not logged in - default to free
        setPlan('free');
        setStripeCustomerId(null);
        setLoading(false);
        return;
      }

      // Fetch plan from backend using token-based authentication
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
      const response = await fetch(
        `${backendUrl}/users/plan`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
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
    let cancelled = false;

    (async () => {
      await fetchPlan();
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger, fetchPlan]);

  return {
    plan,
    stripe_customer_id: stripeCustomerId,
    loading,
    error,
    refetch,
  };
}
