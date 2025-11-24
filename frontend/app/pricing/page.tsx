export const dynamic = 'force-dynamic';

import UpgradeButton from '@/components/UpgradeButton';

const PRICE_PRO = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || 'price_1SKIBTRvsQUM0wWd1P0WWjCz';
const PRICE_INVESTOR =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_INVESTOR || 'price_1SNDCSRvsQUM0wWd5c5RaJiA';

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
  description: 'Choose your PropNexus plan — Free, Pro, or Investor.',
};

export default function PricingPage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-3 text-center text-brand-600 dark:text-brand-400">
        Choose your plan
      </h1>
      <p className="text-center text-slate-600 dark:text-slate-400 mb-10">
        Select the perfect plan for your property investment journey
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* ==== Free Tier ==== */}
        <section className="card hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">Free</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Basic property search, filters, and up to 5 saved deals.
          </p>
          <div className="text-sm text-slate-500 dark:text-slate-500">£0/month</div>
        </section>

        {/* ==== Pro Tier ==== */}
        <section className="card border-2 border-brand-500 shadow-brand-md relative hover:shadow-brand-lg transition-shadow">
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-brand-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
            Popular
          </div>
          <h2 className="text-xl font-semibold mb-3 text-brand-600 dark:text-brand-400">Pro</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Off-market explorer, AI summaries, and PDF deal packs.
          </p>
          <div className="mb-4">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">£29/month</div>
            <div className="text-sm text-brand-600 dark:text-brand-400 font-medium mt-1">
              7-day free trial
            </div>
          </div>
          <UpgradeButton priceId={PRICE_PRO}>Start 7-Day Free Trial</UpgradeButton>
        </section>

        {/* ==== Investor Tier ==== */}
        <section className="card hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">Investor</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Everything in Pro + portfolio analytics, ROI breakdowns, and alerts.
          </p>
          <div className="mb-4">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">£49/month</div>
            <div className="text-sm text-brand-600 dark:text-brand-400 font-medium mt-1">
              7-day free trial
            </div>
          </div>
          <UpgradeButton priceId={PRICE_INVESTOR}>Start 7-Day Free Trial</UpgradeButton>
        </section>
      </div>

      <p className="mt-12 text-center text-sm text-slate-500 dark:text-slate-400">
        Start with a 7-day free trial. No payment required during trial. Cancel anytime.
      </p>
    </main>
  );
}
