'use client';

import Link from 'next/link';
import { FiZap, FiTrendingUp, FiMapPin, FiDollarSign, FiBarChart2, FiShield } from 'react-icons/fi';

export default function HomePreview() {
  const features = [
    {
      icon: FiZap,
      title: 'AI-Powered Search',
      description: 'Intelligent property discovery with machine learning algorithms',
      gradient: 'from-brand-400 to-brand-600',
    },
    {
      icon: FiTrendingUp,
      title: 'Market Analytics',
      description: 'Real-time insights on property values and investment trends',
      gradient: 'from-cyan-400 to-teal-600',
    },
    {
      icon: FiMapPin,
      title: 'Location Intelligence',
      description: 'Comprehensive area analysis and neighborhood scoring',
      gradient: 'from-teal-400 to-emerald-600',
    },
    {
      icon: FiDollarSign,
      title: 'ROI Calculator',
      description: 'Instant yield and return on investment calculations',
      gradient: 'from-emerald-400 to-green-600',
    },
    {
      icon: FiBarChart2,
      title: 'Portfolio Tracking',
      description: 'Monitor and manage all your property investments in one place',
      gradient: 'from-blue-400 to-brand-600',
    },
    {
      icon: FiShield,
      title: 'Verified Listings',
      description: 'All properties vetted and verified for accuracy and legitimacy',
      gradient: 'from-indigo-400 to-purple-600',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Gradient */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-cyan-500">
        {/* Decorative Elements */}
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="relative max-w-7xl mx-auto px-4 py-24 sm:py-32">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 mb-8">
              <FiZap className="w-4 h-4 text-white" />
              <span className="text-sm font-semibold text-white">AI-Powered Property Platform</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Discover Your Next
              <br />
              <span className="bg-gradient-to-r from-white to-cyan-100 bg-clip-text text-transparent">
                Investment Property
              </span>
            </h1>

            <p className="text-xl sm:text-2xl text-brand-50 max-w-3xl mx-auto mb-10 leading-relaxed">
              Smart property sourcing powered by AI. Analyze yields, calculate ROI, and find the perfect investment with confidence.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/preview/listings"
                className="w-full sm:w-auto px-8 py-4 rounded-brand-lg bg-white text-brand-600 font-bold text-lg hover:bg-brand-50 shadow-brand-xl hover:shadow-brand-lg transition-all duration-brand focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-600"
              >
                Browse Properties
              </Link>
              <Link
                href="/preview/pricing"
                className="w-full sm:w-auto px-8 py-4 rounded-brand-lg bg-white/10 backdrop-blur-sm border-2 border-white/50 text-white font-bold text-lg hover:bg-white/20 transition-all duration-brand focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-600"
              >
                View Pricing
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto mt-16 pt-8 border-t border-white/20">
              <div>
                <div className="text-4xl font-bold text-white mb-2">10k+</div>
                <div className="text-brand-100 text-sm">Properties</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-white mb-2">98%</div>
                <div className="text-brand-100 text-sm">Satisfaction</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-white mb-2">£2.4B</div>
                <div className="text-brand-100 text-sm">Total Value</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Everything You Need to Invest Smarter
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Comprehensive tools and insights to help you make informed property investment decisions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group bg-white border border-slate-200 rounded-brand-xl p-8 hover:shadow-brand-lg hover:border-brand-300 transition-all duration-brand"
              >
                <div className={`w-14 h-14 rounded-brand-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-brand`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-slate-50 to-brand-50 py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-6">
            Ready to Start Your Investment Journey?
          </h2>
          <p className="text-xl text-slate-600 mb-10">
            Join thousands of investors who trust PropNexus to find their next property.
          </p>
          <Link
            href="/preview/auth"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-brand-lg bg-gradient-to-r from-brand-500 to-brand-600 text-white font-bold text-lg hover:from-brand-600 hover:to-brand-700 shadow-brand-lg hover:shadow-brand-xl transition-all duration-brand focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            Get Started Free
            <FiZap className="w-5 h-5" />
          </Link>
        </div>
      </section>

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
