'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StripePortalButton from '@/components/StripePortalButton';

/** Lazy, client-only Supabase helpers (safe for CI/preview) */
async function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key);
}

async function getUserEmail(): Promise<string | null> {
  try {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

async function signOut(): Promise<void> {
  const supabase = await getSupabase();
  if (supabase) await supabase.auth.signOut();
}

/** Force dynamic so we don’t cache auth state */
export const dynamic = 'force-dynamic';

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setEmail(await getUserEmail());
      setHydrated(true);
    })();
  }, []);

  /** Manual/fallback Customer Portal opener (kept visible for redundancy) */
  async function openPortalManually() {
    if (!email) return;
    setErrorMsg(null);
    setLoadingPortal(true);

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20_000);

    try {
      const res = await fetch(`/api/stripe/create-portal-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let detail = '';
        try {
          detail = (await res.json())?.detail ?? '';
        } catch {}
        throw new Error(detail || `Portal request failed (${res.status})`);
      }

      const data = await res.json();
      if (!data?.url) throw new Error('No portal URL returned');
      window.location.href = data.url;
    } catch (e: any) {
      setErrorMsg(e?.message || 'Could not open customer portal');
      setLoadingPortal(false);
    } finally {
      clearTimeout(t);
    }
  }

  async function handleSignOut() {
    await signOut();
    setEmail(null);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight mb-2">Manage Subscription</h1>
      <p className="text-zinc-600 dark:text-zinc-300 mb-6">
        Update your plan, billing details, or cancel anytime.
      </p>

      {!hydrated ? (
        <p>Loading…</p>
      ) : email ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
            <div>
              <div className="text-sm text-zinc-500">Signed in as</div>
              <div className="font-semibold">{email}</div>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </div>

          {/* Primary shadcn-styled portal button */}
          <StripePortalButton email={email} />

          {/* Optional fallback */}
          <button
            onClick={openPortalManually}
            disabled={loadingPortal}
            className="inline-flex items-center gap-2 rounded-md bg-zinc-900 text-white px-4 py-2 font-medium hover:bg-zinc-800 disabled:opacity-60"
            aria-label="Open Stripe Customer Portal"
          >
            {loadingPortal ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Opening portal…
              </>
            ) : (
              'Open Customer Portal'
            )}
          </button>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
            >
              {errorMsg}
            </div>
          )}

          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Looking to upgrade? See{' '}
            <Link href="/pricing" className="underline hover:text-blue-600">
              pricing
            </Link>
            .
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p>You’re not signed in.</p>
          <Link
            href="/magic-login"
            className="inline-flex items-center rounded-md bg-zinc-900 text-white px-4 py-2 font-medium hover:bg-zinc-800"
          >
            Sign in with Magic Link
          </Link>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            After signing in you’ll return here to manage your subscription.
          </div>
        </div>
      )}
    </main>
  );
}
