import UpgradeButton from '@/components/UpgradeButton';

const PRICE_PRO = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || 'price_pro_xxx';
const PRICE_INVESTOR = process.env.NEXT_PUBLIC_STRIPE_PRICE_INVESTOR || 'price_investor_xxx';

export const metadata = {
  title: 'Pricing • PropNexus',
};

export default function PricingPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-6">Choose your plan</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="border rounded p-6">
          <h2 className="text-xl font-medium">Free</h2>
          <p className="opacity-70">Basic search and 5 saved deals.</p>
        </section>
        <section className="border rounded p-6">
          <h2 className="text-xl font-medium">Pro</h2>
          <p className="opacity-70 mb-4">Off-market explorer and AI summaries.</p>
          <UpgradeButton priceId={PRICE_PRO}>Upgrade to Pro</UpgradeButton>
        </section>
        <section className="border rounded p-6">
          <h2 className="text-xl font-medium">Investor</h2>
          <p className="opacity-70 mb-4">Everything in Pro + portfolio analytics.</p>
          <UpgradeButton priceId={PRICE_INVESTOR}>Upgrade to Investor</UpgradeButton>
        </section>
      </div>
    </main>
  );
}
