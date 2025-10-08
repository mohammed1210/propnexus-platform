'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

export default function HeaderClient() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const nav = [
    { href: '/listings',    label: 'Listings' },
    { href: '/off-market',  label: 'Off-Market' },
    { href: '/saved-deals', label: 'Saved Deals' },
    { href: '/analytics',   label: 'Analytics' },
    { href: '/pricing',     label: 'Pricing' },
  ];

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 bg-white/90 dark:bg-zinc-950/90 backdrop-blur supports-[backdrop-filter]:bg-white/70',
        scrolled && 'shadow-sm border-b border-zinc-200/70 dark:border-zinc-800/60'
      )}
      style={{ ['--header-h' as any]: '56px' }}
    >
      {/* Skip link target is the main tag in layout; we provide the link here */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 rounded bg-zinc-900 px-3 py-2 text-white"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          <span className="text-zinc-900 dark:text-zinc-100">PropNexus</span>{' '}
          <span className="opacity-60">Listings</span>
        </Link>

        <div className="flex-1" />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {nav.map(({ href, label }) => {
            const active = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'rounded-md px-3 py-2 text-sm outline-2 outline-offset-2 focus:outline focus:outline-primary/60',
                  active
                    ? 'bg-zinc-100/70 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white'
                )}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <button
          className="ml-2 rounded-md border px-2 py-1 text-sm outline-2 outline-offset-2 hover:bg-zinc-100 focus:outline dark:hover:bg-zinc-800"
          onClick={() => document.documentElement.classList.toggle('dark')}
          aria-label="Toggle dark mode"
        >
          Dark
        </button>
      </div>

      {scrolled && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-4 right-4 z-[60] rounded-md bg-primary px-3 py-2 text-white shadow-lg outline-2 outline-offset-2 hover:opacity-90 focus:outline dark:bg-zinc-800"
          aria-label="Back to top"
        >
          Back to top
        </button>
      )}
    </header>
  );
}
