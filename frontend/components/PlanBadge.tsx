// frontend/components/PlanBadge.tsx
'use client';

import React from 'react';
import { useUserPlan, UserPlan } from '@/lib/useUserPlan';
import { isAuthEnabled } from '@/lib/auth';

interface PlanBadgeProps {
  /**
   * Size variant of the badge
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Show loading spinner instead of plan when loading
   */
  showLoading?: boolean;

  /**
   * Custom className for additional styling
   */
  className?: string;
}

// Color schemes for each plan
const PLAN_COLORS: Record<UserPlan, { bg: string; text: string; border: string }> = {
  free: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-300',
  },
  pro: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
  },
  investor: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-300',
  },
};

// Size classes
const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

/**
 * PlanBadge - Displays the user's current subscription plan as a badge.
 *
 * Features:
 * - Auto-fetches user plan using useUserPlan hook
 * - Color-coded badges for each plan level
 * - Multiple size variants
 * - Loading state support
 * - Accessible with proper ARIA attributes
 *
 * Example usage:
 *   <PlanBadge size="md" />
 */
export default function PlanBadge({
  size = 'md',
  showLoading = true,
  className = '',
}: PlanBadgeProps) {
  if (!isAuthEnabled) {
    return <PlanBadgeNoAuth size={size} className={className} />;
  }

  return <PlanBadgeAuthed size={size} showLoading={showLoading} className={className} />;

}

function PlanBadgeNoAuth({ size, className = '' }: { size: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      className={`inline-flex items-center ${SIZE_CLASSES[size]} rounded-full border font-semibold ${PLAN_COLORS.free.bg} ${PLAN_COLORS.free.text} ${PLAN_COLORS.free.border} ${className}`}
      role="status"
      aria-label="Current plan: free"
    >
      <span className="capitalize">free</span>
    </span>
  );
}

function PlanBadgeAuthed({
  size,
  showLoading,
  className,
}: Required<Pick<PlanBadgeProps, 'size' | 'showLoading' | 'className'>>) {
  const { plan, loading } = useUserPlan();

  // Show loading spinner if enabled and still loading
  if (loading && showLoading) {
    return (
      <div
        className={`inline-flex items-center ${SIZE_CLASSES[size]} rounded-full border bg-gray-100 border-gray-300 ${className}`}
        role="status"
        aria-label="Loading plan information"
      >
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        <span className="ml-1.5 text-gray-600">Loading...</span>
      </div>
    );
  }

  // Get color scheme for current plan
  const colors = PLAN_COLORS[plan] || PLAN_COLORS.free;

  return (
    <span
      className={`inline-flex items-center ${SIZE_CLASSES[size]} rounded-full border font-semibold ${colors.bg} ${colors.text} ${colors.border} ${className}`}
      role="status"
      aria-label={`Current plan: ${plan}`}
    >
      {/* Plan icon */}
      {plan === 'investor' && (
        <svg
          className="w-3.5 h-3.5 mr-1"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )}
      {plan === 'pro' && (
        <svg
          className="w-3.5 h-3.5 mr-1"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}

      <span className="capitalize">{plan}</span>
    </span>
  );
}
