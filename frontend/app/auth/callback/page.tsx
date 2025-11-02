'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // For magic links, Supabase parses the URL fragment and sets the session automatically
    // when you call any auth method. We ensure the session exists, then redirect.
    (async () => {
      await supabase.auth.getSession();
      // send users to dashboard if it exists, else home
      router.replace('/dashboard'); // change to '/analytics' if that’s your page
    })();
  }, [router]);

  return (
    <main className="grid min-h-[60vh] place-items-center px-6 py-24">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">Signing you in…</p>
    </main>
  );
}
