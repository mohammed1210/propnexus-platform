'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiSearch, FiTrendingUp, FiZap, FiMapPin, FiDollarSign, FiBarChart2 } from 'react-icons/fi';
import '../styles/homepage-hero.css';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = new URLSearchParams();
    if (q.trim()) query.set('q', q.trim());
    router.push(`/listings?${query.toString()}`);
  }

  return (
    <div className="homepage-hero">
      {/* Floating animated orbs for visual interest */}
      {mounted && (
        <>
          <div className="orb orb-1" aria-hidden="true" />
          <div className="orb orb-2" aria-hidden="true" />
          <div className="orb orb-3" aria-hidden="true" />
        </>
      )}
      
      <main className="relative z-10 w-full">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-24 grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Headline + Search */}
          <section className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 mb-6 shadow-lg shadow-indigo-500/10">
              <FiZap className="text-indigo-300 w-4 h-4" aria-hidden="true" />
              <p className="text-xs md:text-sm font-semibold text-indigo-100 tracking-wide">
                AI-POWERED PROPERTY SOURCING
              </p>
            </div>
            
            <h1 className="mt-3 text-[2.5rem] md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight">
              <span className="block bg-gradient-to-r from-white via-slate-100 to-indigo-100 bg-clip-text text-transparent drop-shadow-sm">
                Discover Investment
              </span>
              <span className="block bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mt-2">
                Properties with AI
              </span>
            </h1>

            <p className="mt-6 text-slate-100/95 max-w-prose text-lg md:text-xl leading-relaxed font-medium">
              Let AI find the best deals. Analyze yield, ROI, and market trends instantly.
              Your intelligent property sourcing assistant.
            </p>

            {/* Search with AI indicator */}
            <form onSubmit={onSubmit} className="mt-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-40 group-hover:opacity-60 transition duration-300" aria-hidden="true"></div>
                <div className="relative flex w-full max-w-xl overflow-hidden rounded-xl border border-white/20 bg-white shadow-2xl focus-within:ring-2 focus-within:ring-indigo-400 focus-within:ring-offset-2 focus-within:ring-offset-transparent">
                  <div className="flex items-center pl-4">
                    <FiSearch className="text-slate-400 w-5 h-5" aria-hidden="true" />
                  </div>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Enter location, city, or postcode…"
                    className="flex-1 h-14 px-3 text-slate-900 placeholder-slate-500 outline-none bg-transparent text-base"
                    aria-label="Search by location or postcode"
                  />
                  <button
                    type="submit"
                    className="h-14 px-6 font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 active:scale-95 transition-all duration-200 flex items-center gap-2"
                    aria-label="Search properties"
                  >
                    <FiZap className="w-4 h-4" aria-hidden="true" />
                    Search
                  </button>
                </div>
              </div>

              {/* examples */}
              <p className="mt-3 text-sm text-slate-200/90 flex items-center gap-2">
                <FiMapPin className="w-4 h-4 text-indigo-300" aria-hidden="true" />
                Try:{' '}
                <button
                  type="button"
                  className="underline hover:text-indigo-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-transparent rounded px-1"
                  onClick={() => router.push('/listings?q=SW1A')}
                >
                  SW1A
                </button>{' '}
                or{' '}
                <button
                  type="button"
                  className="underline hover:text-indigo-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-transparent rounded px-1"
                  onClick={() => router.push('/listings?q=Manchester')}
                >
                  Manchester
                </button>
              </p>

              {/* AI Features Grid */}
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="group flex items-start gap-3 p-4 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.12] hover:bg-white/[0.12] hover:border-white/20 hover:scale-[1.02] transition-all duration-300 cursor-default shadow-lg hover:shadow-xl">
                  <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300">
                    <FiZap className="w-5 h-5 text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm mb-1">AI Deal Scoring</p>
                    <p className="text-xs text-slate-300 leading-relaxed">Smart ranking of investment opportunities</p>
                  </div>
                </div>

                <div className="group flex items-start gap-3 p-4 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.12] hover:bg-white/[0.12] hover:border-white/20 hover:scale-[1.02] transition-all duration-300 cursor-default shadow-lg hover:shadow-xl">
                  <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300">
                    <FiTrendingUp className="w-5 h-5 text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm mb-1">Instant Analytics</p>
                    <p className="text-xs text-slate-300 leading-relaxed">Real-time yield & ROI calculations</p>
                  </div>
                </div>

                <div className="group flex items-start gap-3 p-4 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.12] hover:bg-white/[0.12] hover:border-white/20 hover:scale-[1.02] transition-all duration-300 cursor-default shadow-lg hover:shadow-xl">
                  <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300">
                    <FiMapPin className="w-5 h-5 text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm mb-1">Smart Filtering</p>
                    <p className="text-xs text-slate-300 leading-relaxed">Map view with advanced filters</p>
                  </div>
                </div>

                <div className="group flex items-start gap-3 p-4 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.12] hover:bg-white/[0.12] hover:border-white/20 hover:scale-[1.02] transition-all duration-300 cursor-default shadow-lg hover:shadow-xl">
                  <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300">
                    <FiDollarSign className="w-5 h-5 text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm mb-1">ROI Optimizer</p>
                    <p className="text-xs text-slate-300 leading-relaxed">Maximize your investment returns</p>
                  </div>
                </div>
              </div>
            </form>

            {/* Quick links */}
            <div className="mt-10 flex flex-wrap items-center gap-3 text-sm animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Link
                href="/listings"
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600/30 to-purple-600/30 text-indigo-100 hover:from-indigo-600/50 hover:to-purple-600/50 border border-indigo-400/30 hover:border-indigo-400/50 transition-all duration-200 font-medium shadow-lg hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-transparent"
              >
                Browse listings
              </Link>
              <Link
                href="/analytics"
                className="px-5 py-2.5 rounded-lg bg-white/10 text-slate-100 hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent"
              >
                Analytics
              </Link>
              <Link
                href="/deals"
                className="px-5 py-2.5 rounded-lg bg-white/10 text-slate-100 hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent"
              >
                Saved deals
              </Link>
            </div>
          </section>

          {/* Right: AI Dashboard Preview */}
          <section className="hidden md:block animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <div className="relative mx-auto w-full max-w-xl aspect-[16/10] rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-md shadow-2xl overflow-hidden hover:scale-[1.02] transition-transform duration-500">
              {/* Animated gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 animate-pulse-slow" aria-hidden="true"></div>
              
              <svg viewBox="0 0 600 380" className="absolute inset-0 h-full w-full">
                <defs>
                  <radialGradient id="g1" cx="50%" cy="50%" r="60%">
                    <stop offset="0%" stopColor="rgba(99,102,241,0.9)" />
                    <stop offset="100%" stopColor="rgba(99,102,241,0)" />
                  </radialGradient>
                  <radialGradient id="g2" cx="30%" cy="30%" r="40%">
                    <stop offset="0%" stopColor="rgba(168,85,247,0.7)" />
                    <stop offset="100%" stopColor="rgba(168,85,247,0)" />
                  </radialGradient>
                  <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(99,102,241,0.3)" />
                    <stop offset="100%" stopColor="rgba(168,85,247,0.3)" />
                  </linearGradient>
                </defs>

                {/* Render animated network only on client */}
                {mounted && (
                  <>
                    <g opacity="0.4">
                      {Array.from({ length: 20 }).map((_, i) => {
                        const x1 = Math.random() * 600;
                        const y1 = Math.random() * 380;
                        const x2 = Math.random() * 600;
                        const y2 = Math.random() * 380;
                        return (
                          <line
                            key={i}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="url(#lg1)"
                            strokeWidth="1.5"
                          />
                        );
                      })}
                    </g>
                    {/* Node circles */}
                    <g opacity="0.6">
                      {Array.from({ length: 12 }).map((_, i) => {
                        const cx = Math.random() * 600;
                        const cy = Math.random() * 380;
                        const r = 2 + Math.random() * 3;
                        return (
                          <circle
                            key={`node-${i}`}
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill="rgba(168,85,247,0.8)"
                          />
                        );
                      })}
                    </g>
                  </>
                )}
                <circle cx="460" cy="200" r="140" fill="url(#g1)" />
                <circle cx="200" cy="120" r="100" fill="url(#g2)" />
              </svg>

              <div className="relative z-10 h-full w-full p-6 flex flex-col justify-between">
                {/* AI Badge */}
                <div className="flex justify-end">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold shadow-lg">
                    <FiZap className="w-3 h-3" />
                    AI Powered
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="space-y-3">
                  <div className="rounded-lg bg-white/95 backdrop-blur-sm p-4 shadow-xl border border-indigo-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Live Insights</p>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs text-emerald-600 font-medium">Live</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="text-center">
                        <p className="text-xs text-slate-500 mb-1">Avg Yield</p>
                        <p className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">6.1%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-500 mb-1">Avg ROI</p>
                        <p className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">14.8%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-500 mb-1">New Today</p>
                        <p className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">28</p>
                      </div>
                    </div>
                  </div>

                  {/* AI Score indicator */}
                  <div className="rounded-lg bg-gradient-to-r from-indigo-500/90 to-purple-600/90 backdrop-blur-sm p-3 shadow-xl">
                    <div className="flex items-center justify-between text-white">
                      <div className="flex items-center gap-2">
                        <FiTrendingUp className="w-4 h-4" />
                        <span className="text-xs font-medium">AI Deal Score</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xl font-bold">8.7</span>
                        <span className="text-xs opacity-75">/10</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom CTA strip with gradient */}
        <div className="mx-auto max-w-7xl px-4 pb-20 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <div className="relative rounded-2xl border border-white/20 bg-gradient-to-r from-indigo-900/70 via-purple-900/70 to-pink-900/70 backdrop-blur-sm p-8 shadow-2xl overflow-hidden hover:shadow-3xl transition-shadow duration-300">
            {/* Decorative gradient orbs */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/30 rounded-full blur-3xl" aria-hidden="true"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/30 rounded-full blur-3xl" aria-hidden="true"></div>
            
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="text-xl font-semibold text-white flex items-center justify-center md:justify-start gap-2 mb-2">
                  <FiZap className="w-6 h-6 text-indigo-300" aria-hidden="true" />
                  Ready to find your next investment?
                </p>
                <p className="text-sm text-slate-200">
                  Browse live properties with instant AI-powered insights
                </p>
              </div>
              <Link
                href="/listings"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3.5 text-base font-semibold text-slate-900 hover:bg-slate-50 active:scale-95 transition-all duration-200 shadow-xl hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-transparent whitespace-nowrap"
              >
                View Listings
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
