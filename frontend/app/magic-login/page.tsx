'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function MagicLoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  // 👇 Define the SITE URL properly here
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://propnexus-platform.vercel.app'; // fallback for build env

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${site}/auth/callback`,
        },
      });

      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-2xl font-semibold mb-4">Magic Link Login</h1>
      <form onSubmit={sendLink} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-zinc-900 text-white py-2 font-medium hover:bg-zinc-800 disabled:opacity-60"
        >
          {loading ? 'Sending link…' : 'Send Magic Link'}
        </button>
      </form>

      {sent && (
        <p className="mt-4 text-green-600">
          ✅ Email sent successfully — check your inbox!
        </p>
      )}
      {error && (
        <p className="mt-4 text-red-600">
          ⚠️ {error}
        </p>
      )}
    </main>
  );
}
