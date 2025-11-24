// frontend/components/property_details/GatedPanel.tsx
'use client';

import { ReactNode } from 'react';
import { useUserPlan } from '@/lib/useUserPlan';
import { hasAccess } from '@/lib/planPermissions';
import LockedFeature from '@/components/LockedFeature';

interface GatedPanelProps {
  children: ReactNode;
  title: string;
  requiredPlan: 'pro' | 'investor';
  featureEnabled: boolean;
}

/**
 * Wrapper component for premium features that should be gated behind subscription plans.
 * Shows a blurred preview with upgrade CTA when user doesn't have the required plan.
 */
export default function GatedPanel({
  children,
  title,
  requiredPlan,
  featureEnabled,
}: GatedPanelProps) {
  const { plan, loading } = useUserPlan();

  // Simple local-dev bypass so designers/PMs can preview gated UI
  const bypassGating =
    typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BYPASS_GATING === 'true';

  // Feature flag check
  if (!featureEnabled) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded"></div>
        <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-4/6"></div>
      </div>
    );
  }

  // Check if user has access using shared utility
  const userHasAccess = bypassGating || hasAccess(plan, requiredPlan);

  if (!userHasAccess) {
    return (
      <LockedFeature
        title={title}
        requiredPlan={requiredPlan === 'pro' ? 'Pro' : 'Investor'}
        message={`Unlock ${title} with ${requiredPlan === 'pro' ? 'Pro' : 'Investor'} plan`}
      >
        {children}
      </LockedFeature>
    );
  }

  // User has access - render content
  return <>{children}</>;
}
