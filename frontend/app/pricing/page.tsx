export const dynamic = 'force-dynamic';

import StartFreeButton from '@/components/StartFreeButton';
import UpgradeButton from '@/components/UpgradeButton';
import WaitlistForm from '@/components/WaitlistForm';
import LegalNotice from '@/components/legal/LegalNotice';
import { SOFT_LAUNCH_BETA_NOTICE } from '@/lib/legalCopy';
import { FOUNDING_MEMBER_COPY, getCheckoutConfigForPlan, pricingPlans } from '@/lib/pricingPlans';

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
  description: 'Choose your PropNexus plan — Free, Investor Starter or Investor Pro.',
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 pb-16 pt-20 sm:pt-24 lg:pt-28">
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-400">
          Sprint 2 launch pricing
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-5xl">
          Choose your plan
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400 sm:text-lg">
          Start free, then upgrade when you want full deal labels, offer ranges and the printable Deal Pack workflow.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          {FOUNDING_MEMBER_COPY}
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4 lg:mt-16">
        {pricingPlans.map((plan) => {
          const checkout = getCheckoutConfigForPlan(plan.id);
          const highlight = plan.id === 'investor_pro';

          return (
            <section
              key={plan.id}
              className={`card relative flex h-full flex-col p-7 transition-shadow hover:shadow-lg sm:p-8 ${
                highlight ? 'border-2 border-brand-500 shadow-brand-md hover:shadow-brand-lg' : ''
              }`}
            >
              {plan.badge ? (
                <div className="absolute -top-3 left-6 rounded-full bg-brand-600 px-4 py-1 text-xs font-semibold text-white shadow-sm">
                  {plan.badge}
                </div>
              ) : null}

              <div className="flex-1">
                <h2 className={`text-2xl font-semibold ${highlight ? 'text-brand-600 dark:text-brand-400' : 'text-slate-900 dark:text-slate-100'}`}>
                  {plan.name}
                </h2>
                <p className="mt-3 min-h-[4.5rem] text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {plan.description}
                </p>
                <div className="mt-6">
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
                      {plan.monthlyLabel.replace('/month', '')}
                    </span>
                    <span className="pb-1 text-sm font-medium text-slate-500 dark:text-slate-400">/month</span>
                  </div>
                  {plan.futureMonthlyPrice ? (
                    <div className="mt-2 text-sm font-medium text-brand-600 dark:text-brand-400">
                      Launch price. Later £{plan.futureMonthlyPrice}/month.
                    </div>
                  ) : null}
                </div>

                <ul className="mt-7 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  {plan.includes.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-brand-500" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.locked?.length ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Not included
                    </div>
                    <p className="mt-2">{plan.locked.join(' • ')}</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-8">
                {plan.ctaMode === 'free' ? (
                  <StartFreeButton className="btn-secondary w-full justify-center">{plan.ctaLabel}</StartFreeButton>
                ) : plan.ctaMode === 'checkout' ? (
                  <UpgradeButton priceId={checkout.priceId} productId={checkout.productId} className="btn-primary w-full justify-center">
                    {plan.ctaLabel}
                  </UpgradeButton>
                ) : (
                  <button type="button" disabled className="btn-secondary w-full cursor-not-allowed justify-center opacity-70">
                    {plan.ctaLabel}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Free stays available. Investor Starter unlocks the first paid layer. Investor Pro unlocks the full Deal Pack workflow and PDF export.
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
