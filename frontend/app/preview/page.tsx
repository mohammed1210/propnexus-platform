'use client';

import Link from 'next/link';
import { FiHome, FiNavigation, FiList, FiFileText, FiDollarSign, FiLock, FiArrowRight, FiTrendingUp, FiMapPin, FiKey } from 'react-icons/fi';

export default function PreviewHub() {
  const previews = [
    {
      title: 'Navigation',
      description: 'Professional header with investor-focused CTAs',
      href: '/preview/nav',
      icon: FiNavigation,
      color: 'from-brand-500 to-brand-600',
      badge: 'Core UI',
    },
    {
      title: 'Home',
      description: 'Premium hero section with property showcase and market insights',
      href: '/preview/home',
      icon: FiHome,
      color: 'from-brand-400 to-cyan-500',
      badge: 'Landing',
    },
    {
      title: 'Listings',
      description: 'Advanced property search with filters, high-quality cards and interactive map',
      href: '/preview/listings',
      icon: FiList,
      color: 'from-cyan-500 to-teal-500',
      badge: 'Discovery',
    },
    {
      title: 'Property Details',
      description: 'Comprehensive property showcase with financials, ROI calculator and neighborhood data',
      href: '/preview/details',
      icon: FiKey,
      color: 'from-teal-500 to-brand-600',
      badge: 'Investment',
    },
    {
      title: 'Pricing',
      description: 'Investor tier plans with feature comparison and ROI projections',
      href: '/preview/pricing',
      icon: FiDollarSign,
      color: 'from-brand-600 to-indigo-600',
      badge: 'Plans',
    },
    {
      title: 'Authentication',
      description: 'Secure investor portal access with magic-link authentication',
      href: '/preview/auth',
      icon: FiLock,
      color: 'from-indigo-600 to-purple-600',
      badge: 'Access',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-cyan-600 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC4xIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20" />

        <div className="relative max-w-7xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 mb-6">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-semibold">Live Design Preview</span>
              </div>
              <h1 className="text-5xl font-bold mb-4 leading-tight">
                PropNexus
                <br />
                <span className="bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent">
                  UI Preview System
                </span>
              </h1>
              <p className="text-xl text-brand-50 mb-8 leading-relaxed">
                Experience the new professional real-estate design system with enhanced blue/teal brand palette, sophisticated property showcases, and investor-focused features.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-brand-lg px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FiTrendingUp className="w-6 h-6 text-emerald-300" />
                    <div>
                      <div className="text-2xl font-bold">6</div>
                      <div className="text-sm text-brand-100">Preview Pages</div>
                    </div>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-brand-lg px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FiMapPin className="w-6 h-6 text-cyan-300" />
                    <div>
                      <div className="text-2xl font-bold">100%</div>
                      <div className="text-sm text-brand-100">Property Focused</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden md:block">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-cyan-400 to-brand-400 rounded-brand-xl blur-2xl opacity-30" />
                <div className="relative bg-white/10 backdrop-blur-md border border-white/20 rounded-brand-xl p-6 space-y-4">
                  <div className="h-4 bg-white/30 rounded w-3/4" />
                  <div className="h-4 bg-white/20 rounded w-1/2" />
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="h-24 bg-gradient-to-br from-cyan-400/30 to-brand-500/30 rounded-brand" />
                    <div className="h-24 bg-gradient-to-br from-brand-400/30 to-indigo-500/30 rounded-brand" />
                  </div>
                  <div className="h-4 bg-white/20 rounded w-2/3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white rounded-brand-xl border border-slate-200 p-6 shadow-brand">
            <div className="w-12 h-12 rounded-brand-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center mb-4">
              <FiHome className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Real Estate Focus</h3>
            <p className="text-slate-600 text-sm">Professional property showcase with high-quality visuals and detailed investment metrics</p>
          </div>
          <div className="bg-white rounded-brand-xl border border-slate-200 p-6 shadow-brand">
            <div className="w-12 h-12 rounded-brand-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center mb-4">
              <FiTrendingUp className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Investor Analytics</h3>
            <p className="text-slate-600 text-sm">ROI calculators, yield projections, and market insights built into every view</p>
          </div>
          <div className="bg-white rounded-brand-xl border border-slate-200 p-6 shadow-brand">
            <div className="w-12 h-12 rounded-brand-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center mb-4">
              <FiMapPin className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Location Intelligence</h3>
            <p className="text-slate-600 text-sm">Interactive maps, neighborhood data, and area analytics for informed decisions</p>
          </div>
        </div>

        {/* Preview Cards Grid */}
        <h2 className="text-3xl font-bold text-slate-900 mb-8">Explore Preview Pages</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {previews.map((preview) => {
            const Icon = preview.icon;
            return (
              <Link
                key={preview.href}
                href={preview.href}
                className="group relative bg-white rounded-brand-xl border border-slate-200 overflow-hidden hover:shadow-brand-lg transition-all duration-brand"
              >
                {/* Gradient Background on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${preview.color} opacity-0 group-hover:opacity-5 transition-opacity duration-brand`} />

                <div className="relative p-6">
                  {/* Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                      {preview.badge}
                    </span>
                    <FiArrowRight className="w-5 h-5 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all duration-brand" />
                  </div>

                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-brand-lg bg-gradient-to-br ${preview.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-brand shadow-brand`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Content */}
                  <h2 className="text-xl font-bold text-slate-900 mb-2">
                    {preview.title}
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {preview.description}
                  </p>
                </div>

                {/* Bottom accent line */}
                <div className={`h-1 bg-gradient-to-r ${preview.color} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-brand origin-left`} />
              </Link>
            );
          })}
        </div>

        {/* Info Footer */}
        <div className="mt-16 bg-gradient-to-br from-white to-brand-50 border border-brand-200 rounded-brand-xl p-8 shadow-brand">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center shadow-brand">
              <span className="text-white font-bold text-xl">i</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">About This Preview System</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5" />
                    <span>Professional real-estate design language with blue/teal palette</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5" />
                    <span>Enhanced property showcases with high-quality visual hierarchy</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5" />
                    <span>Investor-focused features including ROI calculators and analytics</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                    <span>All pages isolated under <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">/preview/*</code> with no production impact</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                    <span>Self-contained components using Tailwind brand utilities</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                    <span>Responsive layouts optimized for desktop and mobile investors</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
