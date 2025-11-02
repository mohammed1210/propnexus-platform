'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function AuthCallback() {
  const [status, setStatus] = useState<'loading'|'ok'|'error'>('loading');

  useEffect(() => {
    const run = async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key);

      // Try PKCE exchange first (OAuth/code flow)
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          // Magic-link hash tokens path (#access_token=...)
          // getSession() will read the URL fragment and persist the session
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) {
            // Try once more after a micro-tick to allow Supabase to parse hash
            await new Promise(r => setTimeout(r, 50));
            const { data: d2 } = await supabase.auth.getSession();
            if (!d2.session) throw new Error('No session from magic link');
          }
        }

        setStatus('ok');
        // Send users to their account/billing page
        window.location.replace('/account');
      } catch (e) {
        console.error(e);
        setStatus('error');
      }
    };
    run();
  }, []);

  return (
    <main className="grid place-items-center min-h-[60vh] px-6">
      {status === 'loading' && <p>Signing you in…</p>}
      {status === 'error' && (
        <p className="text-red-600">
          We couldn’t complete your sign-in. Please request a new magic link.
        </p>
      )}
    </main>
  );
}
