'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  const pathname = usePathname();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSessionEmail(data.session?.user?.email ?? null);
    };

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.signOut();
    setSessionEmail(null);
    window.location.href = '/';
  };

  const links = [
    { href: '/', label: 'Home' },
    { href: '/listings', label: 'Listings' },
    { href: '/off-market', label: 'Off-Market' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/pricing', label: 'Pricing' },
    ...(sessionEmail ? [{ href: '/account', label: 'Account' }] : []),
  ];

  return (
    <header
      className={clsx(
        'sticky top-0 z-50 w-full border-b border-zinc-200 bg-white backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900',
      )}
      role="banner"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Brand */}
        <Link href="/" className="text-2xl font-semibold tracking-tight flex items-end gap-1">
          <span className="text-blue-600 dark:text-blue-400">Prop</span>
          <span className="text-zinc-900 dark:text-zinc-100">Nexus</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-2" aria-label="Primary">
          {links.map(({ href, label }) => {
            const active = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'rounded-md px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-zinc-800 dark:text-blue-300'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                )}
              >
                {label}
              </Link>
            );
          })}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Auth actions */}
          {sessionEmail ? (
            <div className="flex items-center gap-3 ml-3 text-sm">
              <span className="text-zinc-600 dark:text-zinc-300">
                Signed in as <strong>{sessionEmail}</strong>
              </span>
              <button
                onClick={handleSignOut}
                className="rounded-md bg-zinc-900 dark:bg-zinc-800 px-3 py-2 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 text-sm transition-colors duration-200"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/magic-login"
              className="ml-3 rounded-md bg-zinc-900 dark:bg-zinc-800 px-3 py-2 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 text-sm font-semibold transition-colors duration-200"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
