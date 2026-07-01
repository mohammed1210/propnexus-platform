// frontend/lib/planPermissions.ts
import { UserPlan } from './useUserPlan';
import { getLaunchPlanId } from './entitlements';
import { getPricingPlan } from './pricingPlans';

// Plan hierarchy: free < pro < investor
const PLAN_LEVELS: Record<UserPlan, number> = {
  free: 0,
  pro: 1,
  investor: 2,
};

/**
 * Check if a user's plan meets or exceeds the required plan level.
 * Uses hierarchical comparison: investor > pro > free
 *
 * @param userPlan - The user's current plan
 * @param requiredPlan - The minimum required plan
 * @returns true if user has access, false otherwise
 *
 * @example
 * hasAccess('pro', 'free') // true - pro >= free
 * hasAccess('free', 'pro') // false - free < pro
 * hasAccess('investor', 'pro') // true - investor >= pro
 */
export function hasAccess(userPlan: UserPlan, requiredPlan: UserPlan): boolean {
  const userLevel = PLAN_LEVELS[userPlan] || 0;
  const requiredLevel = PLAN_LEVELS[requiredPlan] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Get a human-readable label for a plan.
 *
 * @param plan - The plan to get a label for
 * @returns Capitalized plan name
 */
export function getPlanLabel(plan: UserPlan): string {
  const launchPlanId = getLaunchPlanId(plan);
  return getPricingPlan(launchPlanId).name;
}

/**
 * Get the article (a/an) for a plan name.
 *
 * @param plan - The plan to get an article for
 * @returns 'an' for 'investor', 'a' for others
 */
export function getPlanArticle(plan: UserPlan): string {
  const label = getPlanLabel(plan);
  return /^[aeiou]/i.test(label) ? 'an' : 'a';
}

/**
 * Generate a default upgrade message for a required plan.
 *
 * @param requiredPlan - The plan required for access
 * @returns A user-friendly message
 */
export function getUpgradeMessage(requiredPlan: UserPlan): string {
  const label = getPlanLabel(requiredPlan);
  return `Upgrade to ${label} to unlock this feature.`;
}
