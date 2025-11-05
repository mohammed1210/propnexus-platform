// frontend/components/PlanGate.tsx
/**
 * Plan gating component - restricts access based on user plan
 */
'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useUserPlan, UserPlan } from '@/lib/useUserPlan';

interface PlanGateProps {
  children: ReactNode;
  requiredPlan: UserPlan;
  fallback?: ReactNode;
}

/**
 * PlanGate - Conditionally render content based on user's plan
 * 
 * @param children - Content to render if user has required plan
 * @param requiredPlan - Minimum plan required ('free', 'pro', 'enterprise')
 * @param fallback - Optional custom fallback when access is denied
 */
export default function PlanGate({ children, requiredPlan, fallback }: PlanGateProps) {
  const { data, loading, error } = useUserPlan();

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-xl mb-2">⚠️</div>
          <p className="text-slate-600">Unable to verify your plan.</p>
          <p className="text-sm text-slate-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  // Not authenticated or insufficient plan
  // If no data, user is not authenticated - treat as 'free'
  // If data exists but plan is missing, something is wrong - also treat as 'free' but could log
  const userPlan = data ? (data.plan || 'free') : 'free';
  const hasAccess = checkPlanAccess(userPlan, requiredPlan);

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-lg p-8 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold mb-2">Upgrade Required</h2>
          <p className="text-slate-600 mb-6">
            This feature requires a <span className="font-semibold capitalize">{requiredPlan}</span> plan or higher.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/pricing"
              className="inline-flex items-center px-6 py-3 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              View Plans
            </Link>
            <Link
              href="/"
              className="inline-flex items-center px-6 py-3 rounded-md border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Go Home
            </Link>
          </div>
          {!data && (
            <p className="text-sm text-slate-500 mt-4">
              Already have an account?{' '}
              <Link href="/magic-login" className="text-blue-600 hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    );
  }

  // User has access
  return <>{children}</>;
}

/**
 * Check if user's plan meets the required plan level
 */
function checkPlanAccess(userPlan: UserPlan, requiredPlan: UserPlan): boolean {
  const planHierarchy: Record<UserPlan, number> = {
    free: 0,
    pro: 1,
    enterprise: 2,
  };

  return planHierarchy[userPlan] >= planHierarchy[requiredPlan];
}
