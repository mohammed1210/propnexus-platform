'use client';

import Link from 'next/link';
import { FiCheck, FiZap } from 'react-icons/fi';

export default function PricingPreview() {
  const plans = [
    {
      name: 'Free',
      description: 'Perfect for getting started',
      price: '£0',
      period: 'forever',
      features: [
        'Browse all properties',
        'Basic search filters',
        'Save up to 5 properties',
        'Property details view',
        'Community support',
      ],
      cta: 'Get Started',
      highlight: false,
      gradient: 'from-slate-400 to-slate-600',
    },
    {
      name: 'Pro',
      description: 'For serious investors',
      price: '£29',
      period: 'per month',
      features: [
        'Everything in Free',
        'Advanced AI filters',
        'Unlimited saved properties',
        'Mortgage calculator',
        'SDLT calculator',
        'Market analytics',
        'Price alerts',
        'Priority support',
      ],
      cta: 'Start Free Trial',
      highlight: true,
      gradient: 'from-brand-500 to-cyan-500',
      badge: 'Most Popular',
    },
    {
      name: 'Enterprise',
      description: 'For property professionals',
      price: '£99',
      period: 'per month',
      features: [
        'Everything in Pro',
        'Portfolio management',
        'API access',
        'White-label option',
        'Custom integrations',
        'Dedicated account manager',
        'Advanced reporting',
        'Team collaboration',
      ],
      cta: 'Contact Sales',
      highlight: false,
      gradient: 'from-indigo-500 to-purple-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-100 border border-brand-200 mb-4">
            <FiZap className="w-4 h-4 text-brand-600" />
            <span className="text-sm font-semibold text-brand-700">Simple, Transparent Pricing</span>
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Start free and upgrade as your investment portfolio grows. No hidden fees, cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-white rounded-brand-xl border-2 p-8 flex flex-col transition-all duration-brand ${
                plan.highlight
                  ? 'border-brand-500 shadow-brand-xl hover:shadow-brand-lg transform hover:-translate-y-2'
                  : 'border-slate-200 shadow-brand hover:shadow-brand-md hover:-translate-y-1'
              }`}
            >
              {/* Badge for highlighted plan */}
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className={`px-4 py-1.5 rounded-full bg-gradient-to-r ${plan.gradient} text-white text-sm font-bold shadow-brand`}>
                    {plan.badge}
                  </div>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6">
                <div className={`inline-flex w-14 h-14 rounded-brand-lg bg-gradient-to-br ${plan.gradient} items-center justify-center mb-4`}>
                  <span className="text-2xl font-bold text-white">{plan.name[0]}</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h2>
                <p className="text-slate-600">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-slate-900">{plan.price}</span>
                  <span className="text-slate-600">/ {plan.period}</span>
                </div>
              </div>

              {/* Features List */}
              <div className="flex-1 mb-8">
                <ul className="space-y-4">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br ${plan.gradient} flex items-center justify-center mt-0.5`}>
                        <FiCheck className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA Button */}
              <button
                className={`w-full h-12 rounded-brand font-bold transition-all duration-brand focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  plan.highlight
                    ? `bg-gradient-to-r ${plan.gradient} text-white hover:opacity-90 shadow-brand hover:shadow-brand-md focus:ring-brand-500`
                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-500'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="bg-white rounded-brand-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Can I change plans later?
              </h3>
              <p className="text-slate-600">
                Yes! You can upgrade, downgrade, or cancel your plan at any time. Changes take effect immediately.
              </p>
            </div>
            <div className="bg-white rounded-brand-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Do you offer refunds?
              </h3>
              <p className="text-slate-600">
                We offer a 14-day money-back guarantee on all paid plans. If you&apos;re not satisfied, we&apos;ll refund you in full.
              </p>
            </div>
            <div className="bg-white rounded-brand-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-slate-600">
                We accept all major credit cards, debit cards, and bank transfers. Enterprise plans can be invoiced.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="mt-16 bg-gradient-to-r from-brand-600 via-brand-500 to-cyan-500 rounded-brand-xl p-8 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Still have questions?
          </h2>
          <p className="text-xl text-brand-50 mb-8 max-w-2xl mx-auto">
            Our team is here to help. Get in touch and we&apos;ll answer any questions you have.
          </p>
          <Link
            href="/preview/auth"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-brand-lg bg-white text-brand-600 font-bold text-lg hover:bg-brand-50 shadow-brand-xl transition-all duration-brand"
          >
            Contact Sales
          </Link>
        </div>
      </div>

      {/* Back Link */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link
          href="/preview"
          className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 font-semibold transition-colors duration-brand"
        >
          ← Back to Preview Hub
        </Link>
      </div>
    </div>
  );
}
