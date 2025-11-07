'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
      {/* Layered gradient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(80rem 40rem at 10% -10%, rgba(99,102,241,.25), transparent 60%), radial-gradient(80rem 40rem at 110% 10%, rgba(56,189,248,.25), transparent 60%), linear-gradient(180deg, rgba(15,23,42,.75), rgba(15,23,42,.85))',
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
            <p className="text-xs md:text-sm font-semibold tracking-[0.2em] text-indigo-300">
              PROP NEXUS
            </p>
            <h1 className="mt-2 text-[2rem] md:text-5xl font-extrabold leading-tight text-white">
              AI-Powered Property
              <span className="block text-indigo-300">Sourcing Platform</span>
            </h1>

            <p className="mt-4 text-slate-200/90 max-w-prose">
              Discover investment opportunities, score deals with AI, and analyse yield & ROI in
              seconds. Start by searching a location or postcode.
            </p>

            {/* Search */}
            <form onSubmit={onSubmit} className="mt-7">
              <div className="flex w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-white/95 shadow-xl focus-within:ring-2 focus-within:ring-indigo-400 md:bg-white">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by area, city, or postcode…"
                  className="flex-1 h-12 px-4 text-slate-900 placeholder-slate-500 outline-none"
                  aria-label="Search by location or postcode"
                />
                <button
                  type="submit"
                  className="h-12 px-5 font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                >
                  Search
                </button>
              </div>

              {/* examples */}
              <p className="mt-2 text-sm text-slate-300">
                e.g.{' '}
                <button
                  type="button"
                  className="underline"
                  onClick={() => router.push('/listings?q=SW1A')}
                >
                  SW1A
                </button>{' '}
                or{' '}
                <button
                  type="button"
                  className="underline"
                  onClick={() => router.push('/listings?q=Manchester')}
                >
                  Manchester
                </button>
              </p>

              {/* bullets */}
              <ul className="mt-6 space-y-2 text-slate-200/95 text-[15px] md:text-base">
                <li className="flex items-start gap-2">
                  <span aria-hidden>🤖</span>
                  <span>AI deal scoring to prioritise the best opportunities.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span aria-hidden>📊</span>
                  <span>Instant yield & ROI metrics with configurable inputs.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span aria-hidden>🗺️</span>
                  <span>Map view of fresh listings — filtered by budget & beds.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span aria-hidden>🔗</span>
                  <span>One-click export to CRM (coming soon).</span>
                </li>
              </ul>
            </form>

            {/* Quick links */}
            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
              <Link
                href="/listings"
                className="px-3 py-1.5 rounded-full bg-indigo-600/20 text-indigo-200 hover:bg-indigo-600/30"
              >
                Browse listings
              </Link>
              <Link
                href="/analytics"
                className="px-3 py-1.5 rounded-full bg-indigo-600/20 text-indigo-200 hover:bg-indigo-600/30"
              >
                Portfolio analytics
              </Link>
              <Link
                href="/deals"
                className="px-3 py-1.5 rounded-full bg-indigo-600/20 text-indigo-200 hover:bg-indigo-600/30"
              >
                Saved deals
              </Link>
            </div>
          </section>

          {/* Right: Decorative tile */}
          <section className="hidden md:block">
            <div className="relative mx-auto w-full max-w-xl aspect-[16/10] rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-md shadow-2xl overflow-hidden">
              {/* AI Assisted Badge */}
              <div className="absolute top-4 right-4 z-20">
                <div className="px-3 py-1.5 rounded-full bg-indigo-600/90 text-white text-xs font-medium flex items-center gap-1.5 shadow-lg">
                  <span aria-hidden>✨</span>
                  <span>AI Assisted</span>
                </div>
              </div>

              {/* Heatmap canvas */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                aria-hidden="true"
              />

              {/* Heatmap toggle */}
              <div className="absolute top-4 left-4 z-20">
                <button
                  onClick={() => setHeatmapDarkMode(!heatmapDarkMode)}
                  className="px-3 py-1.5 rounded-full bg-white/90 text-slate-900 text-xs font-medium hover:bg-white transition-colors shadow-md"
                  aria-label={`Switch to ${heatmapDarkMode ? 'warm' : 'dark'} palette`}
                >
                  {heatmapDarkMode ? '🌙 Dark' : '☀️ Warm'}
                </button>
              </div>

              <div className="relative z-10 h-full w-full p-6 flex flex-col justify-end">
                <div className="rounded-lg bg-white/90 p-4 shadow">
                  <p className="text-xs font-medium text-slate-500">Realtime Signals</p>
                  <div className="mt-1 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Avg Yield</p>
                      <p className="font-semibold">6.1%</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Avg ROI</p>
                      <p className="font-semibold">14.8%</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Deals Today</p>
                      <p className="font-semibold">28</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom CTA strip */}
        <div className="mx-auto max-w-7xl px-4 pb-16">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-slate-200 flex items-center justify-between">
            <p className="text-sm">New here? Jump straight to the live feed of properties.</p>
            <Link
              href="/listings"
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              View Listings →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
