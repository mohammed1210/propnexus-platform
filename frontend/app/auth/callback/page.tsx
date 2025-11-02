'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic'; // don’t prerender this route

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    const run = async () => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
        if (!url || !key) throw new Error('Supabase env missing');

        const supabase = createClient(url, key);

        // Give supabase-js a tick to parse the URL hash and set the session.
        await new Promise((r) => setTimeout(r, 50));

        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error('No session from magic link');

        setStatus('ok');
        router.replace('/account'); // ✅ send users to the Account page
      } catch (e) {
        console.error(e);
        setStatus('error');
      }
    };
    run();
  }, [router]);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-2xl font-semibold mb-3">Signing you in…</h1>
      {status === 'loading' && <p>Verifying your link…</p>}
      {status === 'ok' && <p>Success. Redirecting…</p>}
      {status === 'error' && (
        <p className="text-red-600">
          Couldn’t verify your link. Please request a new one from{' '}
          <a className="underline" href="/magic-login">Magic Login</a>.
        </p>
      )}
    </main>
  );
}
