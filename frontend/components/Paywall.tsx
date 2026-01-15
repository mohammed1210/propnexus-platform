'use client';

import React from 'react';
import PlanGate from '@/components/PlanGate';
import type { UserPlan } from '@/lib/useUserPlan';

/**
 * Paywall (legacy name)
 *
 * This now delegates to PlanGate so all UI gating is consistent
 * with the backend `/users/plan` source of truth.
 */
export default function Paywall({
  children,
  require = 'pro',
}: {
  children: React.ReactNode;
  require?: UserPlan;
}) {
  return <PlanGate require={require}>{children}</PlanGate>;
}
