// frontend/lib/useUserPlan.ts
import { useEffect, useState } from 'react';
import { getSupabase } from './supabaseClient';

export type UserPlan = 'free' | 'pro' | 'investor';

export interface UserPlanData {
  plan: UserPlan;
  stripe_customer_id: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to fetch and track the current user's subscription plan.
 * 
 * 1. Gets the authenticated user email from Supabase auth
 * 2. Fetches plan details from backend /users/plan endpoint
 * 3. Returns plan, stripe_customer_id, loading state, and error
 * 
 * Usage:
 *   const { plan, loading, error } = useUserPlan();
 *   if (loading) return <div>Loading...</div>;
 *   if (plan === 'investor') return <InvestorContent />;
 */
export function useUserPlan(): UserPlanData {
  const [plan, setPlan] = useState<UserPlan>('free');
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPlan() {
      try {
        setLoading(true);
        setError(null);

        // Get authenticated user email from Supabase
        const sb = getSupabase();
        const { data: userData, error: authError } = await sb.auth.getUser();

        if (authError) {
          throw new Error(`Auth error: ${authError.message}`);
        }

        const email = userData?.user?.email;
        if (!email) {
          // User not logged in - default to free
          if (!cancelled) {
            setPlan('free');
            setStripeCustomerId(null);
            setLoading(false);
          }
          return;
        }

        // Fetch plan from backend
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        const response = await fetch(
          `${backendUrl}/users/plan?email=${encodeURIComponent(email)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch plan: ${response.status}`);
        }

        const data = await response.json();

        if (!cancelled) {
          setPlan((data.plan as UserPlan) || 'free');
          setStripeCustomerId(data.stripe_customer_id || null);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[useUserPlan] Error:', err);
        if (!cancelled) {
          setError(err.message || 'Failed to fetch user plan');
          setPlan('free'); // Fallback to free on error
          setLoading(false);
        }
      }
    }

    fetchPlan();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    plan,
    stripe_customer_id: stripeCustomerId,
    loading,
    error,
  };
}
