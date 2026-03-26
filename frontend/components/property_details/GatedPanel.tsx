// frontend/components/property_details/GatedPanel.tsx
'use client';

import { ReactNode } from 'react';
import { useUserPlan } from '@/lib/useUserPlan';
import { getPlanLabel, hasAccess } from '@/lib/planPermissions';
import LockedFeature from '@/components/LockedFeature';
import { isAuthEnabled } from '@/lib/auth';

interface GatedPanelProps {
  children: ReactNode;
  title: string;
  requiredPlan: 'pro' | 'investor';
  featureEnabled: boolean;
  showPreviewWhenLocked?: boolean;
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
  showPreviewWhenLocked = true,
}: GatedPanelProps) {
  // Simple local-dev bypass so designers/PMs can preview gated UI
  const bypassGating =
    typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BYPASS_GATING === 'true';

  // Feature flag check
  if (!featureEnabled) {
    return null;
  }

  // If auth is disabled (or Clerk keys missing), fail open and render the feature.
  // This avoids build-time failures from Clerk hooks.
  if (!isAuthEnabled) {
    return <>{children}</>;
  }

  return (
    <GatedPanelAuthed
      title={title}
      requiredPlan={requiredPlan}
      featureEnabled={featureEnabled}
      bypassGating={bypassGating}
      showPreviewWhenLocked={showPreviewWhenLocked}
    >
      {children}
    </GatedPanelAuthed>
  );
}

function GatedPanelAuthed({
  children,
  title,
  requiredPlan,
  featureEnabled,
  bypassGating,
  showPreviewWhenLocked,
}: GatedPanelProps & { bypassGating: boolean }) {
  const { plan, loading } = useUserPlan();

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
    const requiredLabel = requiredPlan === 'pro' ? 'Pro' : 'Investor';
    const currentLabel = getPlanLabel(plan);
    return (
      <LockedFeature
        title={title}
        requiredPlan={requiredLabel}
        message={`${title} is available on ${requiredLabel} and Investor plans. Your current plan is ${currentLabel}.`}
        showPreview={showPreviewWhenLocked}
      >
        {children}
      </LockedFeature>
    );
  }

  // User has access - render content
  return <>{children}</>;
}
