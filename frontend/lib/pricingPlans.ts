import type { UserPlan } from '@/lib/useUserPlan';

export type PricingPlanId = 'free' | 'investor_starter' | 'investor_pro' | 'sourcer_pro';

export type PricingPlan = {
  id: PricingPlanId;
  backendPlan: UserPlan | null;
  name: string;
  badge?: string;
  monthlyLabel: string;
  launchMonthlyPrice: number;
  futureMonthlyPrice: number | null;
  description: string;
  ctaLabel: string;
  ctaMode: 'free' | 'checkout' | 'coming_soon';
  checkout: {
    priceEnv?: string;
    productEnv?: string;
    fallbackProductId?: string;
  };
  includes: string[];
  locked?: string[];
  comingSoon?: boolean;
};

const STARTER_PRICE_ID = (process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || '').trim();
const STARTER_PRODUCT_ID = (process.env.NEXT_PUBLIC_STRIPE_PRODUCT_PRO || '').trim();
const PRO_PRICE_ID = (process.env.NEXT_PUBLIC_STRIPE_PRICE_INVESTOR || '').trim();
const PRO_PRODUCT_ID = (process.env.NEXT_PUBLIC_STRIPE_PRODUCT_INVESTOR || 'prod_TGprLukyGJfRBH').trim();
const SOURCER_PRICE_ID = (process.env.NEXT_PUBLIC_STRIPE_PRICE_SOURCER_PRO || '').trim();
const SOURCER_PRODUCT_ID = (process.env.NEXT_PUBLIC_STRIPE_PRODUCT_SOURCER_PRO || '').trim();

export const FOUNDING_MEMBER_COPY =
  'Founding member pricing available for early users. Prices may increase as PropNexus adds more data, Deal Pack features and integrations.';

export const pricingPlans: PricingPlan[] = [
  {
    id: 'free',
    backendPlan: 'free',
    name: 'Free',
    monthlyLabel: '£0/month',
    launchMonthlyPrice: 0,
    futureMonthlyPrice: null,
    description: 'Explore the Deal Desk with lightweight previews before you upgrade.',
    ctaLabel: 'Start free',
    ctaMode: 'free',
    checkout: {},
    includes: [
      '3 basic analyses/month',
      'Basic Deal Label preview',
      'Basic yield estimate',
      'Limited saved deals',
    ],
    locked: ['Full offer range', 'Full Deal Pack', 'PDF export', 'Finance stress-test'],
  },
  {
    id: 'investor_starter',
    backendPlan: 'pro',
    name: 'Investor Starter',
    badge: 'Launch price',
    monthlyLabel: '£9/month',
    launchMonthlyPrice: 9,
    futureMonthlyPrice: 19,
    description: 'For investors who want a sharper deal read before they offer.',
    ctaLabel: 'Start Starter',
    ctaMode: 'checkout',
    checkout: {
      priceEnv: STARTER_PRICE_ID,
      productEnv: STARTER_PRODUCT_ID,
    },
    includes: [
      'Full Deal Label',
      'Basic offer range where evidence supports it',
      'Saved deals workspace',
      'Investor checklist',
    ],
    locked: ['Full Deal Pack', 'PDF export', 'Finance stress-test'],
  },
  {
    id: 'investor_pro',
    backendPlan: 'investor',
    name: 'Investor Pro',
    badge: 'Best for live offers',
    monthlyLabel: '£19/month',
    launchMonthlyPrice: 19,
    futureMonthlyPrice: 39,
    description: 'Unlock the full Deal Desk workflow when you are ready to underwrite and move.',
    ctaLabel: 'Start Pro',
    ctaMode: 'checkout',
    checkout: {
      priceEnv: PRO_PRICE_ID,
      productEnv: PRO_PRODUCT_ID,
      fallbackProductId: 'prod_TGprLukyGJfRBH',
    },
    includes: [
      'Full Deal Pack',
      'Target offer, max offer and walk-away price',
      'Finance stress-test',
      'PDF export',
      'Unlimited saved deals (fair usage)',
    ],
  },
  {
    id: 'sourcer_pro',
    backendPlan: null,
    name: 'Sourcer Pro',
    badge: 'Coming next',
    monthlyLabel: '£39/month',
    launchMonthlyPrice: 39,
    futureMonthlyPrice: 79,
    description: 'Reserved for Sprint 3 branded client-ready reporting and sourcer workflows.',
    ctaLabel: 'Coming soon',
    ctaMode: 'coming_soon',
    checkout: {
      priceEnv: SOURCER_PRICE_ID,
      productEnv: SOURCER_PRODUCT_ID,
    },
    includes: ['Coming next: branded sourcer reporting'],
    locked: ['Sprint 3 branded reports', 'Client-ready sourcer exports'],
    comingSoon: true,
  },
];

export function getPricingPlan(planId: PricingPlanId): PricingPlan {
  return pricingPlans.find((plan) => plan.id === planId) ?? pricingPlans[0];
}

export function getCheckoutConfigForPlan(planId: PricingPlanId): {
  priceId?: string;
  productId?: string;
} {
  const plan = getPricingPlan(planId);
  const priceId = plan.checkout.priceEnv?.trim();
  const productId = plan.checkout.productEnv?.trim() || plan.checkout.fallbackProductId?.trim();

  return {
    ...(priceId ? { priceId } : {}),
    ...(productId ? { productId } : {}),
  };
}
