// 'use client' marks this component for Next.js to run on the client side.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

/**
 * A polished, responsive header for the PropNexus platform.  
 *
 * The header sticks to the top of the viewport, provides a skip link for
 * accessibility, shows primary navigation, a dark‑mode toggle and a
 * context‑aware “Back to top” button.  It uses CSS variables
 * defined in `globals.css` to determine its height (`--header-h`).
 */
export default function HeaderClient() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  // When the page scrolls beyond a small threshold, we add a drop shadow
  // and border to the header to visually separate it from the content.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Define the navigation links.  If more pages are added later
  // they can be appended here for automatic rendering.
  const nav = [
    { href: '/listings',    label: 'Listings' },
    { href: '/off-market',  label: 'Off‑Market' },
    { href: '/saved-deals', label: 'Saved Deals' },
    { href: '/analytics',   label: 'Analytics' },
    { href: '/pricing',     label: 'Pricing' },
  ];

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 w-full backdrop-blur',
        scrolled
          ? 'shadow-md border-b border-blue-100 dark:border-zinc-800'
          : 'border-b border-transparent'
      )}
      style={{ ['--header-h' as any]: '64px' }}
    >
      {/* Skip link target is the main tag in layout; this link becomes visible when focused */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 rounded bg-blue-600 px-3 py-2 text-white"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        {/* Branding: split into two spans for subtle accenting */}
        <Link href="/" className="flex items-end gap-1 text-2xl font-semibold tracking-tight">
          <span className="text-blue-600 dark:text-blue-400">Prop</span>
          <span className="text-zinc-900 dark:text-zinc-100">Nexus</span>
        </Link>

        <div className="flex-1" />

        {/* Primary navigation for medium+ screens */}
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
                    : 'text-zinc-600 dark:text-zinc-300 hover:bg-blue-50/60 dark:hover:bg-zinc-800/50 hover:text-blue-700 dark:hover:text-blue-300'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Dark mode toggle */}
        <button
          className="ml-2 rounded-md border border-blue-100 dark:border-zinc-700 px-3 py-2 text-sm font-medium outline-2 outline-offset-2 hover:bg-blue-50 dark:hover:bg-zinc-800 focus:outline"
          onClick={() => document.documentElement.classList.toggle('dark')}
          aria-label="Toggle dark mode"
        >
          {typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'Light' : 'Dark'}
        </button>
      </div>

      {/* Back to top button becomes visible when scrolled */}
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