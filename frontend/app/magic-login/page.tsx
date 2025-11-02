'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export default function MagicLoginPage() {
  const supabase = getSupabase();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle');

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');

    // Important: use your public site URL, not window.origin (prevents localhost redirects)
    // ...
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (typeof window !== 'undefined' ? window.location.origin : undefined);

const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    // Always send users to our callback page (handles tokens & redirects)
    emailRedirectTo: SITE_URL
      ? `${SITE_URL}/auth/callback`
      : undefined,
  },
});

    if (error) {
      console.error(error);
      setStatus('error');
    } else {
      setStatus('sent');
    }
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold mb-4">Magic Link Login</h1>
      <form onSubmit={sendLink} className="space-y-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          className="w-full border rounded px-3 py-2 dark:bg-zinc-900 dark:text-white"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          disabled={status === 'sending'}
          className="px-4 py-2 rounded bg-black text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {status === 'sending' ? 'Sending…' : 'Send Magic Link'}
        </button>
      </form>

      {status === 'sent' && (
        <p className="mt-4 text-green-600 dark:text-green-400">✅ Email sent — check your inbox.</p>
      )}
      {status === 'error' && (
        <p className="mt-4 text-red-600 dark:text-red-400">⚠️ Couldn’t send the link. Try again.</p>
      )}
    </main>
  );
}
