'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    const run = async () => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(url, key);

        // Exchange the URL hash for a session (works for magic-link & oauth)
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) throw new Error('No session from magic link');

        setStatus('ok');

        // Send users to their account/billing page (or home)
        router.replace('/account');
      } catch (e) {
        console.error(e);
        setStatus('error');
      }
    };
    run();
  }, [router]);

  return (
    <main className="max-w-md mx-auto px-6 py-16 text-center">
      {status === 'loading' && <p>Signing you in…</p>}
      {status === 'error' && (
        <p className="text-red-600">We couldn’t complete sign-in. Please try again.</p>
      )}
    </main>
  );
}
