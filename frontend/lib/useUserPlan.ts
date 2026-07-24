'use client';

// frontend/lib/useUserPlan.ts
import { useEffect, useState, useCallback } from 'react';
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
  const fetchPlan = useCallback(async () => {
    if (!isAuthEnabled) {
      setPlan('free');
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/users/plan', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (response.status === 401 || response.status === 403) {
        setPlan('free');
        setLoading(false);
        return;
      }

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
  }, []);

  const refetch = useCallback(async () => {
    await fetchPlan();
  }, [fetchPlan]);

  useEffect(() => {
    void fetchPlan();
  }, [fetchPlan]);

  return {
    plan,
    loading,
    error,
    refetch,
  };
}
