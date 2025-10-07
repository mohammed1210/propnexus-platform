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
    { href: '/listings', label: 'Listings' },
    { href: '/off-market', label: 'Off-Market' },
    { href: '/saved-deals', label: 'Saved Deals' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/pricing', label: 'Pricing' },
  ];

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 bg-white/90 dark:bg-zinc-950/90 backdrop-blur supports-[backdrop-filter]:bg-white/70',
        scrolled && 'shadow-sm border-b border-zinc-200/70 dark:border-zinc-800/60'
      )}
      style={{ ['--header-h' as any]: '56px' }}
    >
      <div className="max-w-6xl mx-auto h-14 px-4 flex items-center gap-3">
        {/* Brand */}
        <Link href="/" className="font-semibold tracking-tight">
          <span className="text-zinc-900 dark:text-zinc-100">PropNexus</span>{' '}
          <span className="opacity-60">Listings</span>
        </Link>

        <div className="flex-1" />

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {nav.map(({ href, label }) => {
            const active = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'px-3 py-2 rounded-md text-sm transition-colors duration-150',
                  active
                    ? 'text-zinc-900 dark:text-zinc-100 bg-zinc-100/70 dark:bg-zinc-800'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-800'
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Dark Mode Toggle */}
        <button
          className="ml-2 rounded-md border px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => document.documentElement.classList.toggle('dark')}
        >
          Dark
        </button>
      </div>

      {/* Back to top button */}
      {scrolled && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-4 right-4 z-50 rounded-md bg-primary px-3 py-2 text-white shadow-lg dark:bg-zinc-800"
        >
          Back to top
        </button>
      )}
    </header>
  );
}
