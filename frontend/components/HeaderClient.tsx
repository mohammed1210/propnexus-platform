'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

/** Lazy, client-only Supabase auth probe */
async function isAuthenticated(): Promise<boolean> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return false; // CI/preview safety
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(url, key);
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}

/**
 * Polished, responsive header for PropNexus.
 * - Sticky, with subtle shadow on scroll
 * - Primary navigation
 * - Dark mode toggle
 * - Back-to-top button
 * - Auth-aware actions: Billing (when authed) or Sign in
 */
export default function HeaderClient() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    // Fire-and-forget auth probe; do not block paint
    (async () => setAuthed(await isAuthenticated()))();
  }, []);

  const nav = [
    { href: '/listings', label: 'Listings' },
    { href: '/off-market', label: 'Off-Market' },
    { href: '/saved-deals', label: 'Saved Deals' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/pricing', label: 'Pricing' },
  ];

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 w-full backdrop-blur bg-white/80 dark:bg-zinc-900/80',
        scrolled
          ? 'shadow-md border-b border-blue-100 dark:border-zinc-800'
          : 'border-b border-transparent',
      )}
      style={{ ['--header-h' as any]: '64px' }}
    >
      {/* Skip link */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 rounded bg-blue-600 px-3 py-2 text-white"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        {/* Brand */}
        <Link href="/" className="flex items-end gap-1 text-2xl font-semibold tracking-tight">
          <span className="text-blue-600 dark:text-blue-400">Prop</span>
          <span className="text-zinc-900 dark:text-zinc-100">Nexus</span>
        </Link>

        <div className="flex-1" />

        {/* Primary nav */}
        <nav className="hidden md:flex items-center gap-2" aria-label="Primary">
          {nav.map(({ href, label }) => {
            const isActive = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'rounded-md px-3 py-2 text-sm font-medium outline-2 outline-offset-2 focus:outline focus:outline-blue-500',
                  isActive
                    ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-zinc-800'
                    : 'text-zinc-600 dark:text-zinc-300 hover:bg-blue-50/60 dark:hover:bg-zinc-800/50 hover:text-blue-700 dark:hover:text-blue-300',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Auth-aware actions */}
        <div className="hidden md:flex items-center gap-2">
          {authed ? (
            <>
              <Link
                href="/billing/account"
                className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
                aria-label="Open billing and manage subscription"
              >
                Billing
              </Link>
              <Link
                href="/dashboard"
                className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Dashboard
              </Link>
            </>
          ) : (
            <Link
              href="/magic-login"
              className="rounded-md bg-zinc-900 text-white px-3 py-2 text-sm font-semibold hover:bg-blue-600"
              aria-label="Sign in with magic link"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Dark mode toggle */}
        <button
          className="ml-2 rounded-md border border-blue-100 dark:border-zinc-700 px-3 py-2 text-sm font-medium outline-2 outline-offset-2 hover:bg-blue-50 dark:hover:bg-zinc-800 focus:outline"
          onClick={() => document.documentElement.classList.toggle('dark')}
          aria-label="Toggle dark mode"
        >
          {typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
            ? 'Light'
            : 'Dark'}
        </button>
      </div>

      {/* Back to top */}
      {scrolled && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-5 right-5 z-[60] rounded-md bg-blue-600 px-3 py-2 text-white shadow-lg outline-2 outline-offset-2 hover:bg-blue-500 focus:outline dark:bg-blue-500 dark:hover:bg-blue-400"
          aria-label="Back to top"
        >
          Back to top
        </button>
      )}
    </header>
  );
}
