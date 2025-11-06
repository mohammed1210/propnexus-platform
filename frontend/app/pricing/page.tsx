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
    <main className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-10 text-center">Choose your plan</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* ==== Free Tier ==== */}
        <section className="border rounded-xl p-8 shadow-sm bg-white/5">
          <h2 className="text-xl font-medium mb-3">Free</h2>
          <p className="opacity-80 mb-6">
            Basic property search, filters, and up to 5 saved deals.
          </p>
          <div className="text-sm opacity-70">£0/month</div>
        </section>

        {/* ==== Pro Tier ==== */}
        <section className="border rounded-xl p-8 shadow-sm bg-white/5">
          <h2 className="text-xl font-medium mb-3">Pro</h2>
          <p className="opacity-80 mb-6">Off-market explorer, AI summaries, and PDF deal packs.</p>
          <div className="text-lg font-semibold mb-6">£29/month</div>
          <UpgradeButton priceId={PRICE_PRO}>Upgrade to Pro</UpgradeButton>
        </section>

        {/* ==== Investor Tier ==== */}
        <section className="border rounded-xl p-8 shadow-sm bg-white/5">
          <h2 className="text-xl font-medium mb-3">Investor</h2>
          <p className="opacity-80 mb-6">
            Everything in Pro + portfolio analytics, ROI breakdowns, and alerts.
          </p>
          <div className="text-lg font-semibold mb-6">£49/month</div>
          <UpgradeButton priceId={PRICE_INVESTOR}>Upgrade to Investor</UpgradeButton>
        </section>
      </div>

      <p className="mt-12 text-center text-sm opacity-60">
        You can cancel or change your plan anytime.
      </p>
    </main>
  );
}
