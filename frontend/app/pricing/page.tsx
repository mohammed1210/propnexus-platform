export const dynamic = 'force-dynamic';

import UpgradeButton from '@/components/UpgradeButton';

const PRICE_PRO = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || 'price_1SKIBTRvsQUM0wWd1P0WWjCz';
const PRICE_INVESTOR =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_INVESTOR || 'price_1SNDCSRvsQUM0wWd5c5RaJiA';

export const metadata = {
  title: 'Pricing • PropNexus',
  description: 'Choose your PropNexus plan — Free, Pro, or Investor.',
};

export default function PricingPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl md:text-4xl font-semibold mb-3 text-center text-blue-600 dark:text-blue-400">
        Choose your plan
      </h1>
      <p className="text-center text-zinc-600 dark:text-zinc-400 mb-10">
        Select the perfect plan for your property investment journey
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {/* ==== Free Tier ==== */}
        <section className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 md:p-8 shadow-sm bg-white dark:bg-zinc-900 hover:shadow-md transition-all duration-200">
          <h2 className="text-xl font-semibold mb-3 text-zinc-900 dark:text-zinc-100">Free</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Basic property search, filters, and up to 5 saved deals.
          </p>
          <div className="text-sm text-zinc-500 dark:text-zinc-500">£0/month</div>
        </section>

        {/* ==== Pro Tier ==== */}
        <section className="border-2 border-blue-500 rounded-xl p-6 md:p-8 shadow-md bg-white dark:bg-zinc-900 relative hover:shadow-lg transition-all duration-200">
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
            Popular
          </div>
          <h2 className="text-xl font-semibold mb-3 text-blue-600 dark:text-blue-400">Pro</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Off-market explorer, AI summaries, and PDF deal packs.
          </p>
          <div className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">£29/month</div>
          <UpgradeButton priceId={PRICE_PRO}>Upgrade to Pro</UpgradeButton>
        </section>

        {/* ==== Investor Tier ==== */}
        <section className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 md:p-8 shadow-sm bg-white dark:bg-zinc-900 hover:shadow-md transition-all duration-200">
          <h2 className="text-xl font-semibold mb-3 text-zinc-900 dark:text-zinc-100">Investor</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Everything in Pro + portfolio analytics, ROI breakdowns, and alerts.
          </p>
          <div className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">£49/month</div>
          <UpgradeButton priceId={PRICE_INVESTOR}>Upgrade to Investor</UpgradeButton>
        </section>
      </div>

      <p className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        You can cancel or change your plan anytime.
      </p>
    </main>
  );
}
