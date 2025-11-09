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
    <main className="flex items-center justify-center min-h-screen px-6 py-12">
      <div className="w-full max-w-md">
        <div
          className="rounded-xl p-8 backdrop-blur-md shadow-xl text-center"
          style={{
            background: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            border: '1px solid',
          }}
        >
          {status === 'idle' && (
            <div className="space-y-4">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-full"
                style={{ background: 'rgba(99, 102, 241, 0.1)' }}
              >
                <div
                  className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
                />
              </div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Finishing sign-in…
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Please wait while we complete your authentication
              </p>
            </div>
          )}

          {status === 'ok' && (
            <div className="space-y-4">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-full"
                style={{ background: 'rgba(16, 185, 129, 0.1)' }}
              >
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: 'var(--success)' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Signed in successfully!
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Redirecting you now…
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-full"
                style={{ background: 'rgba(239, 68, 68, 0.1)' }}
              >
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: 'var(--error)' }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Couldn&apos;t complete sign-in
              </h2>
              {message && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {message}
                </p>
              )}
              <a
                href="/magic-login"
                className="inline-flex items-center px-6 py-3 rounded-lg font-semibold text-white transition-all duration-300 hover:opacity-90"
                style={{ background: 'var(--accent-gradient)' }}
              >
                Send a new magic link
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
