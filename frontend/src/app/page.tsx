// src/app/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = new URLSearchParams();
    if (q.trim()) query.set('q', q.trim());
    router.push(`/listings?${query.toString()}`);
  }

  return (
    <div className="relative min-h-[88vh] overflow-hidden">
      {/* Background: subtle techy gradient + dots */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(80rem 40rem at 10% -10%, rgba(99,102,241,.25), transparent 60%), radial-gradient(80rem 40rem at 110% 10%, rgba(56,189,248,.25), transparent 60%), linear-gradient(180deg, rgba(15,23,42,.65), rgba(15,23,42,.65))',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            'radial-gradient(#ffffff 1px, transparent 1px), radial-gradient(#ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px, 24px 24px',
          backgroundPosition: '0 0, 12px 12px',
        }}
      />

      <main className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-24 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* Left: Headline + Search */}
          <section>
            <p className="text-sm font-semibold tracking-widest text-indigo-300">PROP NEXUS</p>
            <h1 className="mt-2 text-4xl md:text-5xl font-extrabold leading-tight text-white">
              AI-Powered Property
              <span className="block text-indigo-300">Sourcing Platform</span>
            </h1>

            <p className="mt-4 text-slate-200/90 max-w-prose">
              Discover investment opportunities, score deals with AI, and analyse yield & ROI in seconds.
              Start by searching a location or postcode.
            </p>

            {/* Search */}
            <form onSubmit={onSubmit} className="mt-8">
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
              <p className="mt-2 text-sm text-slate-300">
                e.g. <button type="button" className="underline" onClick={() => router.push('/listings?q=SW1A')}>
                  SW1A
                </button>{' '}
                or{' '}
                <button type="button" className="underline" onClick={() => router.push('/listings?q=Manchester')}>
                  Manchester
                </button>
              </p>
            </form>

            {/* Quick links */}
            <div className="mt-8 flex items-center gap-4 text-sm">
              <Link href="/listings" className="text-indigo-300 hover:text-indigo-200 underline">
                Browse listings
              </Link>
              <span className="text-slate-400">•</span>
              <Link href="/analytics" className="text-indigo-300 hover:text-indigo-200 underline">
                Portfolio analytics
              </Link>
              <span className="text-slate-400">•</span>
              <Link href="/deals" className="text-indigo-300 hover:text-indigo-200 underline">
                Saved deals
              </Link>
            </div>
          </section>

          {/* Right: Decorative “AI / data” tile */}
          <section className="hidden md:block">
            <div className="relative mx-auto w-full max-w-xl aspect-[16/10] rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-md shadow-2xl overflow-hidden">
              {/* glowing node web */}
              <svg viewBox="0 0 600 380" className="absolute inset-0 h-full w-full">
                <defs>
                  <radialGradient id="g1" cx="50%" cy="50%" r="60%">
                    <stop offset="0%" stopColor="rgba(99,102,241,0.9)" />
                    <stop offset="100%" stopColor="rgba(99,102,241,0)" />
                  </radialGradient>
                </defs>
                <g opacity="0.7">
                  {[...Array(26)].map((_, i) => {
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
                        stroke="rgba(148,163,184,0.35)"
                        strokeWidth="1"
                      />
                    );
                  })}
                </g>
                <circle cx="460" cy="200" r="140" fill="url(#g1)" />
              </svg>

              {/* Card copy */}
              <div className="relative z-10 h-full w-full p-6 flex flex-col justify-end">
                <div className="rounded-lg bg-white/90 p-4 shadow">
                  <p className="text-xs font-medium text-slate-500">Realtime Signals</p>
                  <div className="mt-1 grid grid-cols-3 gap-3 text-sm">
                    <div><p className="text-slate-500">Avg Yield</p><p className="font-semibold">6.1%</p></div>
                    <div><p className="text-slate-500">Avg ROI</p><p className="font-semibold">14.8%</p></div>
                    <div><p className="text-slate-500">Deals Today</p><p className="font-semibold">28</p></div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom CTA strip */}
        <div className="mx-auto max-w-7xl px-4 pb-16">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-slate-200 flex items-center justify-between">
            <p className="text-sm">
              New here? Jump straight to the live feed of properties.
            </p>
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