'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

function getSiteUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  const env =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL; // e.g. my-app.vercel.app
  if (!env) return 'https://propnexus-platform.vercel.app';
  return env.startsWith('http') ? env : `https://${env}`;
}

export default function MagicLoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const site = getSiteUrl();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Always bounce back to the SAME ORIGIN you started from
          emailRedirectTo: `${site}/auth/callback?returnTo=/account`,
        },
      });

      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Could not send magic link');
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

      {sent && <p className="mt-4 text-green-600">✅ Email sent — check your inbox!</p>}
      {error && <p className="mt-4 text-red-600">⚠️ {error}</p>}
    </main>
  );
}
