'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

type Status = 'idle' | 'ok' | 'error';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const run = async () => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
        const supabase = createClient(url, key);

        // Read tokens from URL hash (Supabase magic link format)
        const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
        const qs = new URLSearchParams(hash || '');

        // Check for error cases first
        const error = qs.get('error') || qs.get('error_code');
        const errorDesc = qs.get('error_description');
        if (error) {
          setStatus('error');
          setMessage(errorDesc || error);
          return;
        }

        // If tokens exist, set the session explicitly
        const access_token = qs.get('access_token');
        const refresh_token = qs.get('refresh_token');
        if (access_token && refresh_token) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (setErr) throw setErr;
        } else {
          // If no tokens in hash, try reading any existing session
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setStatus('error');
            setMessage('No session returned from magic link.');
            return;
          }
        }

        setStatus('ok');

        // Optional returnTo support (read from hash). Default to /account.
        const returnTo = qs.get('returnTo') || '/account';
        router.replace(returnTo);
      } catch (e: any) {
        console.error(e);
        setStatus('error');
        setMessage(e?.message || 'Sign-in failed.');
      }
    };

    run();
  }, [router]);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      {status === 'idle' && <p>Finishing sign-in…</p>}
      {status === 'ok' && <p>Signed in. Redirecting…</p>}
      {status === 'error' && (
        <div className="space-y-3">
          <p className="text-red-600 font-medium">Couldn’t complete sign-in.</p>
          {message && <p className="text-sm text-zinc-600">{message}</p>}
          <a
            href="/magic-login"
            className="inline-flex items-center px-3 py-2 rounded-md bg-zinc-900 text-white hover:bg-zinc-800"
          >
            Send a new magic link
          </a>
        </div>
      )}
    </main>
  );
}
