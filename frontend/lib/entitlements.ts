import type { UserPlan } from '@/lib/useUserPlan';
import { getPricingPlan, type PricingPlanId } from '@/lib/pricingPlans';

export type BackendUserPlan = UserPlan;

export type DealDeskEntitlements = {
  backendPlan: BackendUserPlan;
  launchPlanId: PricingPlanId;
  launchPlanLabel: string;
  hasFullDealLabel: boolean;
  hasBasicOfferRange: boolean;
  hasFullOfferRange: boolean;
  hasDealPack: boolean;
  hasFinanceStressTest: boolean;
  hasPdfExport: boolean;
  hasSourcerBranding: boolean;
};

const VALID_BACKEND_PLANS: BackendUserPlan[] = ['free', 'pro', 'investor'];

export function normalizeBackendPlan(raw: unknown): BackendUserPlan {
  if (typeof raw !== 'string') return 'free';
  const normalized = raw.trim().toLowerCase();
  if (VALID_BACKEND_PLANS.includes(normalized as BackendUserPlan)) {
    return normalized as BackendUserPlan;
  }
  if (normalized === 'investor_starter' || normalized === 'starter') return 'pro';
  if (normalized === 'investor_pro' || normalized === 'pro_plus') return 'investor';
  return 'free';
}

export function getPlanFromUser(payload: { plan?: unknown } | null | undefined): BackendUserPlan {
  return normalizeBackendPlan(payload?.plan);
}

export function getPlanFromStatus(payload: unknown): BackendUserPlan {
  if (payload && typeof payload === 'object') {
    const direct = normalizeBackendPlan((payload as { plan?: unknown }).plan);
    if (direct !== 'free' || (payload as { plan?: unknown }).plan === 'free') return direct;

    const nested = (payload as { subscription?: { plan?: unknown } | null }).subscription;
    if (nested) {
      return normalizeBackendPlan(nested.plan);
    }
  }
  return 'free';
}

export function getLaunchPlanId(plan: BackendUserPlan): PricingPlanId {
  switch (normalizeBackendPlan(plan)) {
    case 'pro':
      return 'investor_starter';
    case 'investor':
      return 'investor_pro';
    default:
      return 'free';
  }
}

export function getEntitlements(plan: BackendUserPlan): DealDeskEntitlements {
  const backendPlan = normalizeBackendPlan(plan);
  const launchPlanId = getLaunchPlanId(backendPlan);
  const launchPlan = getPricingPlan(launchPlanId);
  const level = backendPlan === 'investor' ? 2 : backendPlan === 'pro' ? 1 : 0;

  return {
    backendPlan,
    launchPlanId,
    launchPlanLabel: launchPlan.name,
    hasFullDealLabel: level >= 1,
    hasBasicOfferRange: level >= 1,
    hasFullOfferRange: level >= 2,
    hasDealPack: level >= 2,
    hasFinanceStressTest: level >= 2,
    hasPdfExport: level >= 2,
    hasSourcerBranding: false,
  };
}

export function isPlanConfiguredForCheckout(planId: PricingPlanId): boolean {
  if (planId === 'free' || planId === 'sourcer_pro') return false;
  const plan = getPricingPlan(planId);
  return Boolean(plan.checkout.priceEnv || plan.checkout.productEnv || plan.checkout.fallbackProductId);
}
