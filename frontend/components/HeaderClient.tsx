'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HeaderClient() {
  const [dark, setDark] = useState(false);

  // Restore theme preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      setDark(true);
    }
  }, []);

  // Apply dark mode to <html> element + persist
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      root.dataset.theme = 'dark';
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      delete (root as any).dataset?.theme;
      localStorage.setItem('theme', 'light');
    }
  }, [dark]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/" className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
          PropNexus
        </Link>

        {/* Navigation */}
<nav className="hidden md:flex items-center gap-6">
  <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400">
    Listings
  </Link>
  <Link href="/saved" className="hover:text-indigo-600 dark:hover:text-indigo-400">
    Saved Deals
  </Link>
  <Link href="/off-market" className="hover:text-indigo-600 dark:hover:text-indigo-400">
    Off-Market
  </Link>
  <Link href="/pricing" className="hover:text-indigo-600 dark:hover:text-indigo-400">
    Pricing
  </Link>
</nav>

        {/* Dark mode toggle */}
        <button
          onClick={() => setDark(!dark)}
          className="ml-4 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
        >
          {dark ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}
