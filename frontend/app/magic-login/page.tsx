'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// ✅ Lazy-safe Supabase client (prevents CI build failures)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn('Supabase env vars missing (CI or Preview build)');
    return null; // allows build to continue safely
  }
  return createClient(url, key);
}

export default function MagicLoginPage() {
  const supabase = getSupabase();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      alert('Supabase not configured. Please try again later.');
      return;
    }

    setStatus('sending');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });

    if (error) {
      console.error(error);
      setStatus('error');
      alert(error.message);
    } else {
      setStatus('sent');
      alert('Check your inbox for a magic link!');
    }
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Magic Link Login
      </h1>
      <form onSubmit={sendLink} className="space-y-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          className="w-full border rounded px-3 py-2 dark:bg-gray-800 dark:text-white"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          disabled={status === 'sending'}
          className="px-4 py-2 rounded bg-black text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending...' : 'Send Magic Link'}
        </button>
      </form>

      {status === 'sent' && (
        <p className="mt-4 text-green-600 dark:text-green-400">
          ✅ Email sent successfully — check your inbox!
        </p>
      )}
      {status === 'error' && (
        <p className="mt-4 text-red-600 dark:text-red-400">
          ⚠️ Something went wrong. Please try again.
        </p>
      )}
    </main>
  );
}
