'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiSearch, FiTrendingUp, FiZap, FiMapPin, FiDollarSign } from 'react-icons/fi';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [mounted, setMounted] = useState(false);
  const [heatmapDarkMode, setHeatmapDarkMode] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);

  // Draw animated heatmap on hero canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    canvas.width = parent.offsetWidth;
    canvas.height = parent.offsetHeight;

    let animationId: number;
    let offset = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Generate some decorative heatmap spots
      const spots = [
        { x: canvas.width * 0.3, y: canvas.height * 0.4, r: 120 },
        { x: canvas.width * 0.7, y: canvas.height * 0.6, r: 100 },
        { x: canvas.width * 0.5, y: canvas.height * 0.3, r: 80 },
      ];

      spots.forEach((spot) => {
        const gradient = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spot.r);

        if (heatmapDarkMode) {
          // Dark palette
          gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
          gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.2)');
          gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
        } else {
          // Warm palette
          gradient.addColorStop(0, 'rgba(251, 146, 60, 0.4)');
          gradient.addColorStop(0.5, 'rgba(251, 146, 60, 0.2)');
          gradient.addColorStop(1, 'rgba(251, 146, 60, 0)');
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      });

      offset += 0.5;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [heatmapDarkMode]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = new URLSearchParams();
    if (q.trim()) query.set('q', q.trim());
    router.push(`/listings?${query.toString()}`);
  }

  return (
    <div className="relative min-h-[88vh] overflow-hidden">
      {/* Animated gradient background - Sprint 11.3: lighter purple */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'var(--hero-gradient)',
        }}
      />

      {/* Map grid pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Scanning ring animation */}
      {mounted && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.3) 0%, transparent 30%)',
            animation: 'pulse 4s ease-in-out infinite',
          }}
        />
      )}

      <main className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 py-14 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* Left: Headline + Search */}
          <section>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 mb-4">
              <FiZap className="text-indigo-300 w-4 h-4" />
              <p className="text-xs md:text-sm font-semibold text-indigo-200">
                AI-POWERED PROPERTY SOURCING
              </p>
            </div>
            
            <h1 className="mt-2 text-[2rem] md:text-5xl font-extrabold leading-tight">
              <span className="bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent">
                Discover Investment
              </span>
              <span className="block bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Properties with AI
              </span>
            </h1>

            <p className="mt-4 text-slate-200/90 max-w-prose text-lg">
              Let AI find the best deals. Analyze yield, ROI, and market trends instantly.
              Your intelligent property sourcing assistant.
            </p>

            {/* Search with AI indicator */}
            <form onSubmit={onSubmit} className="mt-7">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-300"></div>
                <div className="relative flex w-full max-w-xl overflow-hidden rounded-xl border border-white/20 bg-white shadow-2xl focus-within:ring-2 focus-within:ring-indigo-400">
                  <div className="flex items-center pl-4">
                    <FiSearch className="text-slate-400 w-5 h-5" />
                  </div>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Enter location, city, or postcode…"
                    className="flex-1 h-14 px-3 text-slate-900 placeholder-slate-500 outline-none bg-transparent"
                    aria-label="Search by location or postcode"
                  />
                  <button
                    type="submit"
                    className="h-14 px-6 font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 transition-all duration-300 flex items-center gap-2"
                  >
                    <FiZap className="w-4 h-4" />
                    Search
                  </button>
                </div>
              </div>

              {/* examples */}
              <p className="mt-3 text-sm text-slate-300 flex items-center gap-2">
                <FiMapPin className="w-4 h-4 text-indigo-300" />
                Try:{' '}
                <button
                  type="button"
                  className="underline hover:text-indigo-300 transition-colors"
                  onClick={() => router.push('/listings?q=SW1A')}
                >
                  SW1A
                </button>{' '}
                or{' '}
                <button
                  type="button"
                  className="underline hover:text-indigo-300 transition-colors"
                  onClick={() => router.push('/listings?q=Manchester')}
                >
                  Manchester
                </button>
              </p>

              {/* AI Features Grid */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <FiZap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">AI Deal Scoring</p>
                    <p className="text-xs text-slate-300 mt-0.5">Smart ranking of investment opportunities</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <FiTrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">Instant Analytics</p>
                    <p className="text-xs text-slate-300 mt-0.5">Real-time yield & ROI calculations</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                    <FiMapPin className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">Smart Filtering</p>
                    <p className="text-xs text-slate-300 mt-0.5">Map view with advanced filters</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <FiDollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">ROI Optimizer</p>
                    <p className="text-xs text-slate-300 mt-0.5">Maximize your investment returns</p>
                  </div>
                </div>
              </div>
            </form>

            {/* Quick links */}
            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
              <Link
                href="/listings"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600/30 to-purple-600/30 text-indigo-200 hover:from-indigo-600/50 hover:to-purple-600/50 border border-indigo-400/30 transition-all duration-300 font-medium"
              >
                Browse listings
              </Link>
              <Link
                href="/analytics"
                className="px-4 py-2 rounded-lg bg-white/10 text-slate-200 hover:bg-white/20 border border-white/20 transition-all duration-300"
              >
                Analytics
              </Link>
              <Link
                href="/deals"
                className="px-4 py-2 rounded-lg bg-white/10 text-slate-200 hover:bg-white/20 border border-white/20 transition-all duration-300"
              >
                Saved deals
              </Link>
            </div>
          </section>

          {/* Right: AI Dashboard Preview */}
          <section className="hidden md:block">
            <div className="relative mx-auto w-full max-w-xl aspect-[16/10] rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-md shadow-2xl overflow-hidden">
              {/* Animated gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 animate-pulse-slow"></div>
              
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
        <div className="mx-auto max-w-7xl px-4 pb-16">
          <div className="relative rounded-2xl border border-white/20 bg-gradient-to-r from-indigo-900/60 via-purple-900/60 to-pink-900/60 backdrop-blur-sm p-6 shadow-2xl overflow-hidden">
            {/* Decorative gradient orbs */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/30 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/30 rounded-full blur-3xl"></div>
            
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white flex items-center gap-2">
                  <FiZap className="w-5 h-5 text-indigo-300" />
                  Ready to find your next investment?
                </p>
                <p className="text-sm text-slate-300 mt-1">
                  Browse live properties with instant AI-powered insights
                </p>
              </div>
              <Link
                href="/listings"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                View Listings
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
