// frontend/lib/useUserPlan.ts
/**
 * Hook to fetch user's plan from backend /users/plan
 */
import { useEffect, useState } from 'react';
import { getSupabase } from './supabaseClient';

export type UserPlan = 'free' | 'pro' | 'enterprise';

export interface UserPlanData {
  email: string;
  plan: UserPlan;
  stripe_customer_id: string | null;
}

export interface UseUserPlanResult {
  data: UserPlanData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetch user plan from backend
 */
export function useUserPlan(): UseUserPlanResult {
  const [data, setData] = useState<UserPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase not configured');
      }

      // Get current session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        // Not authenticated - return free plan
        setData(null);
        setLoading(false);
        return;
      }

      const token = sessionData.session.access_token;
      
      // Call backend API
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/users/plan`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch plan: ${response.status}`);
      }

      const planData: UserPlanData = await response.json();
      setData(planData);
    } catch (err) {
      console.error('[useUserPlan] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchPlan,
  };
}
