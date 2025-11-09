export const dynamic = 'force-dynamic';

import UpgradeButton from '@/components/UpgradeButton';
import { FiCheck, FiLock, FiShield } from 'react-icons/fi';

const PRICE_PRO = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || 'price_1SKIBTRvsQUM0wWd1P0WWjCz';
const PRICE_INVESTOR =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_INVESTOR || 'price_1SNDCSRvsQUM0wWd5c5RaJiA';

export const metadata = {
  title: 'Pricing • PropNexus',
  description: 'Choose your PropNexus plan — Free, Pro, or Investor.',
};

const tiers = [
  {
    name: 'Free',
    price: '£0',
    description: 'Perfect for getting started with property investment',
    priceId: null,
    features: [
      'Browse property listings',
      'Basic search & filters',
      'Save up to 5 deals',
      'Basic calculators',
      'Community support',
    ],
    popular: false,
    accent: false,
  },
  {
    name: 'Pro',
    price: '£29',
    description: 'For serious investors ready to find their next deal',
    priceId: PRICE_PRO,
    features: [
      'Everything in Free',
      'Off-market explorer',
      'AI-powered summaries',
      'PDF deal packs',
      'Advanced analytics',
      'Priority support',
    ],
    popular: true,
    accent: true,
  },
  {
    name: 'Investor',
    price: '£49',
    description: 'Premium features for professional investors',
    priceId: PRICE_INVESTOR,
    features: [
      'Everything in Pro',
      'Portfolio analytics',
      'ROI breakdowns',
      'Deal alerts',
      'Unlimited saved deals',
      'Premium support',
    ],
    popular: false,
    accent: false,
  },
];

export default function PricingPage() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <h1
          className="text-4xl font-bold mb-4 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] bg-clip-text text-transparent"
          style={{
            backgroundImage: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Choose your plan
        </h1>
        <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
          Select the perfect plan for your property investment journey
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {tiers.map((tier) => (
          <section
            key={tier.name}
            className={`
              relative flex flex-col rounded-xl p-8 backdrop-blur-md transition-all duration-300
              ${
                tier.accent
                  ? 'shadow-xl hover:shadow-2xl border-2 transform hover:-translate-y-2'
                  : 'shadow-md hover:shadow-xl hover:-translate-y-1'
              }
            `}
            style={{
              background: tier.accent ? 'var(--card-bg-hover)' : 'var(--card-bg)',
              borderColor: tier.accent ? 'var(--accent-primary)' : 'var(--card-border)',
            }}
          >
            {/* Popular Badge */}
            {tier.popular && (
              <div
                className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ background: 'var(--accent-gradient)' }}
              >
                Recommended
              </div>
            )}

            {/* Header */}
            <div className="mb-6">
              <h2
                className="text-2xl font-bold mb-2"
                style={{
                  color: tier.accent ? 'var(--accent-primary)' : 'var(--text-primary)',
                }}
              >
                {tier.name}
              </h2>
              <p className="text-sm min-h-[2.5rem]" style={{ color: 'var(--text-muted)' }}>
                {tier.description}
              </p>
            </div>

            {/* Price */}
            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {tier.price}
                </span>
                <span className="text-lg" style={{ color: 'var(--text-muted)' }}>
                  /month
                </span>
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-8 flex-grow">
              {tier.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <FiCheck
                    className="flex-shrink-0 mt-0.5"
                    size={18}
                    style={{ color: tier.accent ? 'var(--accent-primary)' : 'var(--success)' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA Button */}
            {tier.priceId ? (
              <div
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-300 ${
                  tier.accent
                    ? 'text-white hover:opacity-90 hover:shadow-lg'
                    : 'border-2 hover:shadow-md'
                }`}
                style={
                  tier.accent
                    ? {
                        background: 'var(--accent-gradient)',
                      }
                    : {
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }
                }
              >
                <UpgradeButton
                  priceId={tier.priceId}
                  className="w-full bg-transparent border-0 p-0 m-0 text-inherit hover:bg-transparent"
                >
                  Upgrade to {tier.name}
                </UpgradeButton>
              </div>
            ) : (
              <div
                className="w-full py-3 px-6 rounded-lg font-semibold text-center border-2"
                style={{
                  borderColor: 'var(--border-secondary)',
                  color: 'var(--text-muted)',
                }}
              >
                Current Plan
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Trust & Security Footer */}
      <div
        className="mt-16 p-6 rounded-xl text-center backdrop-blur-sm"
        style={{
          background: 'var(--surface-subtle)',
          borderColor: 'var(--border-secondary)',
          border: '1px solid',
        }}
      >
        <div className="flex items-center justify-center gap-6 mb-4">
          <div className="flex items-center gap-2">
            <FiShield size={20} style={{ color: 'var(--accent-primary)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Secure payments
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLock size={20} style={{ color: 'var(--accent-primary)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              256-bit encryption
            </span>
          </div>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          You can cancel or change your plan anytime. No hidden fees. All payments processed
          securely through Stripe.
        </p>
      </div>
    </main>
  );
}
