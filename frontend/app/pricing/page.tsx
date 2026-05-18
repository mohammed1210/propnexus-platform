export const dynamic = 'force-dynamic';

import StartFreeButton from '@/components/StartFreeButton';
import UpgradeButton from '@/components/UpgradeButton';
import WaitlistForm from '@/components/WaitlistForm';
import LegalNotice from '@/components/legal/LegalNotice';
import { SOFT_LAUNCH_BETA_NOTICE } from '@/lib/legalCopy';

const INVESTOR_PRODUCT_ID = process.env.NEXT_PUBLIC_STRIPE_PRODUCT_INVESTOR || 'prod_TGprLukyGJfRBH';

const freeFeatures = [
  'Browse property listings',
  'Search and filter deals',
  'View property detail pages',
  'See core quick stats',
  'Save deals to review later',
  'Access basic investment signals where available',
];

const investorFeatures = [
  'Everything in Free',
  'Find stronger evidence signals faster with stricter Top Deal tiers',
  'See what price makes the deal work with Offer Intelligence',
  'Compare sold and rent evidence before bidding',
  'Track price changes, days on market and stale listings',
  'Save search criteria for newly surfaced strong opportunities',
  'AI Deal Score, Investment Summary and strategy guidance',
  'Priority access to new launch features',
];

/**
 * 7-Day Free Trial Configuration:
 *
 * The trial period is configured in the backend at `/stripe/create-checkout-session`
 * via `subscription_data.trial_period_days: 7`. This ensures all paid subscriptions
 * start with a 7-day trial period where no payment is collected.
 *
 * The trial can also be configured directly on the Stripe Price object in the
 * Stripe Dashboard (Price Settings > Trial period). If both are configured,
 * the checkout session setting takes precedence.
 *
 * No additional frontend code is required - Stripe handles the trial logic
 * and the webhook updates the user's plan with `plan_status: "trialing"`.
 */

export const metadata = {
  title: 'Pricing • PropNexus',
  description: 'Choose your PropNexus plan — Free or Investor.',
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 pb-16 pt-20 sm:pt-24 lg:pt-28">
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-400">
          Soft launch pricing
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-5xl">
          Choose your plan
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400 sm:text-lg">
          Start free, then upgrade when you want evidence-led lead triage, offer pricing and saved-search workflows.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:mt-16">
        {/* ==== Free Tier ==== */}
        <section className="card flex h-full flex-col p-7 transition-shadow hover:shadow-lg sm:p-8">
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Free</h2>
            <p className="mt-3 min-h-[3.5rem] text-sm leading-6 text-slate-600 dark:text-slate-400">
              Explore the platform and review live property opportunities.
            </p>
            <div className="mt-6 flex items-end gap-1">
              <span className="text-4xl font-bold tracking-tight text-slate-950 dark:text-slate-50">£0</span>
              <span className="pb-1 text-sm font-medium text-slate-500 dark:text-slate-400">/month</span>
            </div>
            <ul className="mt-7 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              {freeFeatures.map((feature) => (
                <li key={feature} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-brand-500" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8">
            <StartFreeButton className="btn-secondary w-full justify-center">Start Free</StartFreeButton>
          </div>
        </section>

        {/* ==== Investor Tier ==== */}
        <section className="card relative flex h-full flex-col border-2 border-brand-500 p-7 shadow-brand-md transition-shadow hover:shadow-brand-lg sm:p-8">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1 text-xs font-semibold text-white shadow-sm">
            Launch plan
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-brand-600 dark:text-brand-400">Investor</h2>
            <p className="mt-3 min-h-[3.5rem] text-sm leading-6 text-slate-600 dark:text-slate-400">
              For serious investors who want stronger deal analysis and saved-deal workflows.
            </p>
            <div className="mt-6">
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold tracking-tight text-slate-950 dark:text-slate-50">£19</span>
                <span className="pb-1 text-sm font-medium text-slate-500 dark:text-slate-400">/month</span>
              </div>
              <div className="mt-2 text-sm font-medium text-brand-600 dark:text-brand-400">
                7-day free trial
              </div>
            </div>
            <ul className="mt-7 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              {investorFeatures.map((feature) => (
                <li key={feature} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-brand-500" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8">
            <UpgradeButton productId={INVESTOR_PRODUCT_ID}>Start 7-Day Free Trial</UpgradeButton>
          </div>
        </section>
      </div>

      <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Investor starts with a 7-day free trial. No payment required during trial. Cancel anytime.
      </p>

      <LegalNotice title="Subscription note" variant="compact" className="mx-auto mt-5 max-w-3xl">
        Subscription features provide analysis and workflow tools only. PropNexus does not guarantee profitable deals, below-market purchases, finance approval or investment outcomes. {SOFT_LAUNCH_BETA_NOTICE}
      </LegalNotice>

      <section className="mx-auto mt-12 max-w-2xl rounded-2xl border border-slate-200 bg-slate-50/80 p-6 dark:border-slate-800 dark:bg-slate-900/50">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Prefer launch updates first?
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Join the early access waitlist for product updates and launch notes.
        </p>
        <div className="mt-4">
          <WaitlistForm sourcePage="/pricing" />
        </div>
      </section>
    </main>
  );
}
