'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
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
    { href: '/saved', label: 'Saved Deals' },
    { href: '/off-market', label: 'Off-Market' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/analytics', label: 'Analytics' },
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
        {/* brand */}
        <Link href="/" className="font-semibold tracking-tight">
          <span className="text-zinc-900 dark:text-zinc-100">PropNexus</span>
          <span className="opacity-60">Listings</span>
        </Link>

        {/* spacer pushes tabs to the right */}
        <div className="flex-1" />

        {/* right-aligned tabs */}
        <nav className="hidden md:flex items-center gap-1">
          {nav.map(({ href, label }) => {
            const active = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'px-3 py-2 rounded-md text-sm',
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

        {/* theme toggle placeholder (kept as simple text for now) */}
        <button
          className="ml-2 rounded-md border px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => {
            // You can wire your theme toggle here
            document.documentElement.classList.toggle('dark');
          }}
        >
          Dark
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <nav
          id="mobile-nav"
          className="md:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
        >
          <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap gap-3">
            {NAV.map(item => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`text-sm px-3 py-2 rounded border ${
                    active
                      ? 'font-semibold bg-zinc-50 dark:bg-zinc-900'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
