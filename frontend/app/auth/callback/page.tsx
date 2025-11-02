'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams(); // can be null in TS types depending on setup
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabase();
      if (!supabase) {
        setStatus('error');
        router.replace('/magic-login?err=env');
        return;
      }

      try {
        // Works for both magic-link (#access_token) and OAuth code flows.
        await supabase.auth.exchangeCodeForSession(window.location.href).catch(() => {});

        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error('No session from magic link');

        setStatus('ok');

        // Null-safe read of returnTo
        const returnTo =
          (params?.get('returnTo') as string | null) ??
          '/account';

        router.replace(returnTo);
      } catch (e) {
        console.error(e);
        setStatus('error');
        router.replace('/magic-login?err=callback');
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold mb-3">Signing you in…</h1>
      <p className="text-zinc-600 dark:text-zinc-300">
        {status === 'error'
          ? 'We could not complete sign in. Please request a new magic link.'
          : 'Please wait while we complete your sign in.'}
      </p>
    </main>
  );
}
