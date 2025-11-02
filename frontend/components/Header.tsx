'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './Header.module.css';

/**
 * Lightweight client-side auth check using Supabase.
 * - No SSR issues (lazy imports)
 * - If env vars are missing (e.g., Preview/CI), it simply hides the auth-aware links.
 */
async function isAuthenticated(): Promise<boolean> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return false;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(url, key);
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}

export default function Header() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // fire-and-forget, do not block paint
    (async () => setAuthed(await isAuthenticated()))();
  }, []);

  return (
    <header className={styles.header} role="banner">
      {/* Brand → Home */}
      <Link href="/" className={styles.logo} aria-label="PropNexus — Home">
        PropNexus
      </Link>

      {/* Your existing action buttons */}
      <nav className={styles.nav} aria-label="Primary">
        <button type="button" className={styles.button}>
          Search
        </button>
        <button type="button" className={styles.button}>
          Filters
        </button>
        <button type="button" className={styles.button}>
          Map / List
        </button>

        {/* --- Right-side auth-aware actions --- */}
        <div className={styles.rightActions} aria-label="Account actions">
          {authed ? (
            <>
              <Link
                href="/billing/account"
                className={styles.linkButton}
                aria-label="Open billing and manage subscription"
              >
                Billing
              </Link>
              <Link
                href="/dashboard"
                className={styles.linkButton}
                aria-label="Open dashboard"
              >
                Dashboard
              </Link>
            </>
          ) : (
            <Link
              href="/magic-login"
              className={styles.linkPrimary}
              aria-label="Sign in with magic link"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
