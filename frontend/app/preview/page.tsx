'use client';

import Link from 'next/link';
import { FiHome, FiNavigation, FiList, FiFileText, FiDollarSign, FiLock, FiArrowRight } from 'react-icons/fi';

export default function PreviewHub() {
  const previews = [
    {
      title: 'Navigation',
      description: 'Header with Sign in + Get Started CTAs in brand colors',
      href: '/preview/nav',
      icon: FiNavigation,
      color: 'from-brand-500 to-brand-600',
    },
    {
      title: 'Home',
      description: 'Hero gradient (blue/teal) + feature grid cards',
      href: '/preview/home',
      icon: FiHome,
      color: 'from-brand-400 to-cyan-500',
    },
    {
      title: 'Listings',
      description: 'Standardized inputs, filter pills, property cards with map',
      href: '/preview/listings',
      icon: FiList,
      color: 'from-cyan-500 to-teal-500',
    },
    {
      title: 'Property Details',
      description: 'Two-column board: content + sticky sidebar (stats, actions, map)',
      href: '/preview/details',
      icon: FiFileText,
      color: 'from-teal-500 to-brand-600',
    },
    {
      title: 'Pricing',
      description: 'Equal-height tier cards with hover lift and accent plan',
      href: '/preview/pricing',
      icon: FiDollarSign,
      color: 'from-brand-600 to-indigo-600',
    },
    {
      title: 'Authentication',
      description: 'Centered magic-link card for auth flow',
      href: '/preview/auth',
      icon: FiLock,
      color: 'from-indigo-600 to-purple-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-100 border border-brand-200 mb-4">
            <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-sm font-semibold text-brand-700">UI Preview System</span>
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-4">
            PropNexus Design Preview
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Interactive demos showcasing the new blue/teal brand palette and polished UI components.
            These are read-only visual demonstrations isolated from production pages.
          </p>
        </div>

        {/* Preview Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {previews.map((preview) => {
            const Icon = preview.icon;
            return (
              <Link
                key={preview.href}
                href={preview.href}
                className="group relative bg-white rounded-brand-xl border border-slate-200 p-6 hover:shadow-brand-lg transition-all duration-brand"
              >
                {/* Gradient Background on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${preview.color} opacity-0 group-hover:opacity-5 rounded-brand-xl transition-opacity duration-brand`} />
                
                {/* Icon */}
                <div className={`relative w-12 h-12 rounded-brand-lg bg-gradient-to-br ${preview.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-brand`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>

                {/* Content */}
                <div className="relative">
                  <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center justify-between">
                    {preview.title}
                    <FiArrowRight className="w-5 h-5 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all duration-brand" />
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {preview.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Info Footer */}
        <div className="mt-16 p-6 bg-white border border-brand-200 rounded-brand-xl">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
              <span className="text-brand-600 font-bold">ℹ</span>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">About These Previews</h3>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>• All components use the new brand blue/teal palette and Tailwind utilities</li>
                <li>• These pages are isolated under <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">/preview/*</code> and do not affect production</li>
                <li>• Components are self-contained with no external data dependencies</li>
                <li>• Accessibility features include focus states and AA contrast compliance</li>
                <li>• Responsive layouts work on desktop and mobile devices</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
