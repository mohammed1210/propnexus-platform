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
    // Skip Supabase initialization if env vars are not set (e.g., in preview mode)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return;
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
    // Skip if Supabase is not configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return;
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
        {/*
          NOTE: Keep primary navigation visible on small screens.
          A recent change used `className="hidden md:flex ..."` which hid the
          entire link list on mobile without rendering an alternative (e.g.
          hamburger/disclosure) menu. That made core routes (Listings, Pricing,
          Account) unreachable on phones. If you need to hide the links on
          mobile, add a replacement mobile menu before switching to `hidden md:flex`.

          TODO: Replace this inline nav with a responsive menu (Disclosure or
          a separate mobile nav component) so links remain accessible on all
          breakpoints.
        */}
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

          {/*
            Auth actions

            NOTE: Do NOT hide authenticated user controls behind a `hidden md:flex`
            container without providing an alternative for small screens. A recent
            change placed the sign-out UI inside `hidden md:flex`, which meant
            authenticated users on mobile had no way to sign out from the header.

            Keep the sign-out (and other essential account controls) available
            at all breakpoints, or add a dedicated small-screen menu (hamburger
            / disclosure) that exposes these actions on mobile.

            TODO: If you change this to `hidden md:flex`, implement a mobile
            menu component that renders the same account actions for narrow
            viewports before removing the always-visible controls.
          */}
          {sessionEmail ? (
            <div className="flex items-center gap-3 ml-3 text-sm">
              <span className="text-zinc-600 dark:text-zinc-300">
                Signed in as <strong>{sessionEmail}</strong>
              </span>
              <button
                onClick={handleSignOut}
                className="rounded-md bg-black px-3 py-2 text-white hover:bg-zinc-800 text-sm"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/magic-login"
              className="ml-3 rounded-md bg-black px-3 py-2 text-white hover:bg-zinc-800 text-sm font-semibold"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
