'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const NAV = [
  { label: 'Listings',    href: '/listings' },
  { label: 'Saved Deals', href: '/saved' },
  { label: 'Off-Market',  href: '/off-market' },
  { label: 'Pricing',     href: '/pricing' },
  { label: 'Analytics',   href: '/analytics' },
];

export default function HeaderClient() {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  // Expose header height as a CSS var so other sticky bars can align perfectly.
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const setVar = () => {
      const h = `${el.getBoundingClientRect().height}px`;
      document.documentElement.style.setProperty('--header-h', h);
    };
    setVar();
    const ro = new ResizeObserver(setVar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header
      ref={ref}
      className="sticky top-0 z-40 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-xl">PropNexus</Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV.map(item => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm ${active ? 'font-semibold' : 'opacity-80 hover:opacity-100'}`}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => {
              setDark(d => !d);
              document.documentElement.classList.toggle('dark');
            }}
            className="text-sm px-2 py-1 border rounded"
            aria-label="Toggle dark mode"
          >
            {dark ? 'Light' : 'Dark'}
          </button>
        </nav>

        {/* Mobile: menu + theme toggle */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={() => {
              setDark(d => !d);
              document.documentElement.classList.toggle('dark');
            }}
            className="text-sm px-2 py-1 border rounded"
            aria-label="Toggle dark mode"
          >
            {dark ? '☀︎' : '🌙'}
          </button>
          <button
            onClick={() => setOpen(o => !o)}
            className="px-3 py-2 rounded border"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label="Toggle navigation"
          >
            ☰
          </button>
        </div>
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