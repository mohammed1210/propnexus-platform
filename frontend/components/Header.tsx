'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const links = [
  { href: '/', label: 'Home' },
  { href: '/listings', label: 'Listings' },
  { href: '/analytics', label: 'Analytics' },   // or /dashboard if that’s your route
  { href: '/pricing', label: 'Pricing' },
  { href: '/account', label: 'Account' },       // customer portal lives here
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 w-full bg-white/70 backdrop-blur border-b border-zinc-200 dark:bg-zinc-900/70 dark:border-zinc-800'
      )}
      role="banner"
      style={{ ['--header-h' as any]: '64px' }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
        {/* Brand -> Home */}
        <Link href="/" className="text-2xl font-semibold tracking-tight" aria-label="PropNexus — Home">
          <span className="text-blue-600 dark:text-blue-400">Prop</span>
          <span className="text-zinc-900 dark:text-zinc-100">Nexus</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1" aria-label="Primary">
          {links.map(({ href, label }) => {
            const active = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'rounded-md px-3 py-2 text-sm font-medium',
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-zinc-800 dark:text-blue-300'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                )}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </Link>
            );
          })}

          {/* Sign in */}
          <Link
            href="/magic-login"
            className="ml-2 rounded-md bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
