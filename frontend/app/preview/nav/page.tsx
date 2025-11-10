'use client';

import Link from 'next/link';
import { FiMenu, FiX } from 'react-icons/fi';
import { useState } from 'react';

export default function NavigationPreview() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/preview" className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-brand">
                  <span className="text-white font-bold text-sm">PN</span>
                </div>
                <span className="text-xl font-bold text-slate-900">PropNexus</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="/preview/home"
                className="text-slate-600 hover:text-brand-600 font-medium transition-colors duration-brand"
              >
                Home
              </Link>
              <Link
                href="/preview/listings"
                className="text-slate-600 hover:text-brand-600 font-medium transition-colors duration-brand"
              >
                Listings
              </Link>
              <Link
                href="/preview/pricing"
                className="text-slate-600 hover:text-brand-600 font-medium transition-colors duration-brand"
              >
                Pricing
              </Link>
            </div>

            {/* Desktop CTAs */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/preview/auth"
                className="px-4 py-2 text-brand-600 hover:text-brand-700 font-semibold transition-colors duration-brand"
              >
                Sign in
              </Link>
              <Link
                href="/preview/auth"
                className="px-5 py-2 rounded-brand bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold hover:from-brand-600 hover:to-brand-700 shadow-brand hover:shadow-brand-md transition-all duration-brand focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <FiX className="w-6 h-6" />
              ) : (
                <FiMenu className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-slate-200">
              <div className="flex flex-col gap-3">
                <Link
                  href="/preview/home"
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-brand transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="/preview/listings"
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-brand transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Listings
                </Link>
                <Link
                  href="/preview/pricing"
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-brand transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
                  <Link
                    href="/preview/auth"
                    className="px-4 py-2 text-center text-brand-600 font-semibold hover:bg-brand-50 rounded-brand transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/preview/auth"
                    className="px-4 py-2 text-center rounded-brand bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Demo Content */}
      <main className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Navigation Preview</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
            This demonstrates the navigation header with brand colors, CTAs, and responsive mobile menu.
          </p>
          
          <div className="bg-white border border-slate-200 rounded-brand-xl p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Features</h2>
            <ul className="text-left space-y-3 text-slate-600">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Sticky header with brand gradient logo</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Sign in and Get Started CTAs in brand colors</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Responsive mobile menu with smooth transitions</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Focus states for accessibility</span>
              </li>
            </ul>
          </div>

          <Link
            href="/preview"
            className="inline-flex items-center gap-2 mt-8 px-6 py-3 text-brand-600 hover:text-brand-700 font-semibold border border-brand-300 rounded-brand hover:bg-brand-50 transition-all duration-brand"
          >
            ← Back to Preview Hub
          </Link>
        </div>
      </main>
    </div>
  );
}
