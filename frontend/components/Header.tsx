'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Disclosure, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
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
    { href: '/pricing', label: 'Pricing' },
    ...(sessionEmail ? [{ href: '/account', label: 'Account' }] : []),
  ];

  return (
    <header
      className={clsx(
        'sticky top-0 z-50 w-full border-b bg-white backdrop-blur-md shadow-sm',
        'border-slate-200 dark:border-slate-700 dark:bg-slate-900',
      )}
      role="banner"
    >
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-brand-sm">
            <span className="text-white font-bold text-sm">PN</span>
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white">PropNexus</span>
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
            const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'text-sm font-medium transition-colors duration-300',
                  active
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400',
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
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
            <div className="hidden md:flex items-center gap-3 text-sm">
              <span className="text-slate-600 dark:text-slate-300">
                <strong>{sessionEmail}</strong>
              </span>
              <button
                onClick={handleSignOut}
                className="btn-ghost text-sm px-4 py-2"
              >
                Sign out
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/magic-login"
                className="hidden md:inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors duration-300"
              >
                Sign in
              </Link>
              <Link
                href="/magic-login"
                className="btn-primary text-sm px-5 py-2"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
