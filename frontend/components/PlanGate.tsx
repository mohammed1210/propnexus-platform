// frontend/components/PlanGate.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useUserPlan, UserPlan } from '@/lib/useUserPlan';
import { hasAccess, getUpgradeMessage, getPlanLabel } from '@/lib/planPermissions';

interface PlanGateProps {
  /**
   * Required plan level to access the content.
   * Options: 'free', 'pro', 'investor'
   */
  require: UserPlan;
  
  /**
   * Content to show if user has the required plan or higher
   */
  children: React.ReactNode;
  
  /**
   * Optional custom message for when access is denied
   */
  deniedMessage?: string;
  
  /**
   * Optional custom component to show when access is denied
   */
  deniedComponent?: React.ReactNode;
}

/**
 * PlanGate - A component that restricts content based on user subscription plan.
 * 
 * Features:
 * - Shows loading state while checking plan
 * - Shows upgrade message if user doesn't have required plan
 * - Supports plan hierarchy (investor > pro > free)
 * - Customizable denied message and component
 * 
 * Example usage:
 *   <PlanGate require="investor">
 *     <AdvancedAnalytics />
 *   </PlanGate>
 */
export default function PlanGate({
  require,
  children,
  deniedMessage,
  deniedComponent,
}: PlanGateProps) {
  const { plan, loading, error } = useUserPlan();

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error state (but don't block access - fail open)
  if (error) {
    console.warn('[PlanGate] Error checking plan, allowing access:', error);
    return <>{children}</>;
  }

  // Check if user has required plan or higher using shared utility
  const userHasAccess = hasAccess(plan, require);

  if (userHasAccess) {
    return <>{children}</>;
  }

  // User doesn't have access - show denied component or message
  if (deniedComponent) {
    return <>{deniedComponent}</>;
  }

  const defaultMessage = deniedMessage || getUpgradeMessage(require);

  return (
    <div className="flex items-center justify-center min-h-[400px] px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold shadow-lg">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Upgrade Required
          </h2>
          <p className="text-gray-600">{defaultMessage}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            View Pricing
          </Link>
          <Link
            href="/account"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Manage Plan
          </Link>
        </div>

        <p className="text-sm text-gray-500">
          Current plan: <span className="font-semibold">{getPlanLabel(plan)}</span>
        </p>
      </div>
    </div>
  );
}
