'use client';

// frontend/lib/useUserPlan.ts
import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { isAuthEnabled } from '@/lib/auth';

export type UserPlan = 'free' | 'pro' | 'investor';

export interface UserPlanData {
  plan: UserPlan;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch and track the current user's subscription plan.
 * Uses authenticated same-origin proxy route instead of exposing email query usage in the browser.
 */
export function useUserPlan(): UserPlanData {
  const [plan, setPlan] = useState<UserPlan>('free');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { isLoaded: clerkLoaded, user: clerkUser } = useUser();

  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!isAuthEnabled) {
        setPlan('free');
        setLoading(false);
        return;
      }

      if (!clerkLoaded) {
        return;
      }

      if (!clerkUser) {
        setPlan('free');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/users/plan', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch plan: ${response.status}`);
      }

      const data = await response.json();
      setPlan((data.plan as UserPlan) || 'free');
      setLoading(false);
    } catch (err: any) {
      console.error('[useUserPlan] Error:', err);
      setError(err.message || 'Failed to fetch user plan');
      setPlan('free');
      setLoading(false);
    }
  }, [clerkLoaded, clerkUser]);

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
    loading,
    error,
    refetch,
  };
}
