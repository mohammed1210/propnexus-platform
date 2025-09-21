'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// tiny classnames helper (avoids needing the 'clsx' package)
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export default function HeaderClient(): JSX.Element {
  const pathname = usePathname();

  const [scrolled, setScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // mobile menu

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
      className={cx(
        'sticky top-0 z-40 bg-white/90 dark:bg-zinc-950/90 backdrop-blur supports-[backdrop-filter]:bg-white/70',
        scrolled && 'shadow-sm border-b border-zinc-200/70 dark:border-zinc-800/60'
      )}
      // CSS var used elsewhere if you want sticky offsets
      style={{ ['--header-h' as any]: '56px' }}
    >
      <div className="max-w-6xl mx-auto h-14 px-4 flex items-center gap-3">
        {/* brand */}
        <Link href="/" className="font-semibold tracking-tight whitespace-nowrap">
          <span className="text-zinc-900 dark:text-zinc-100">PropNexus</span>{' '}
          <span className="opacity-60">Listings</span>
        </Link>

        {/* spacer pushes tabs to the right */}
        <div className="flex-1" />

        {/* desktop tabs */}
        <nav className="hidden md:flex items-center gap-1">
          {nav.map(({ href, label }) => {
            const active = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={cx(
                  'px-3 py-2 rounded-md text-sm transition-colors',
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

        {/* theme toggle placeholder */}
        <button
          className="hidden md:inline-flex ml-2 rounded-md border px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => document.documentElement.classList.toggle('dark')}
          type="button"
        >
          Dark
        </button>

        {/* mobile menu toggle */}
        <button
          className="md:hidden inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm"
          aria-expanded={isOpen}
          aria-controls="mobile-nav"
          onClick={() => setIsOpen((v) => !v)}
          type="button"
        >
          Menu
        </button>
      </div>

      {/* Mobile dropdown */}
      {isOpen && (
        <nav
          id="mobile-nav"
          className="md:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
        >
          <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap gap-3">
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cx(
                    'text-sm px-3 py-2 rounded border transition-colors',
                    active
                      ? 'font-semibold bg-zinc-50 dark:bg-zinc-900'
                      : 'opacity-80 hover:opacity-100'
                  )}
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
