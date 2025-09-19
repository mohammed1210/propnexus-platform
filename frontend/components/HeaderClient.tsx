'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

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

  return (
    <header className="w-full sticky top-0 z-40 bg-white/70 dark:bg-zinc-950/70 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-xl">
          PropNexus
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {NAV.map(item => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}             // ✅ internal route, no absolute vercel.app URL
                className={`text-sm ${active ? 'font-semibold' : 'opacity-80 hover:opacity-100'}`}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => {
              setDark(d => !d);
              if (typeof document !== 'undefined') {
                document.documentElement.classList.toggle('dark');
              }
            }}
            className="text-sm px-2 py-1 border rounded"
            aria-label="Toggle dark mode"
          >
            {dark ? 'Light' : 'Dark'}
          </button>
        </nav>
      </div>
    </header>
  );
}
