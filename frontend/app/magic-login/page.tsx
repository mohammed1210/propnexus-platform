'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSiteUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL; // e.g. my-app.vercel.app
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
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
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
      <div className="card">
        <h1 className="text-2xl font-semibold mb-2 text-slate-900 dark:text-white">Magic Link Login</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">Enter your email to receive a secure login link</p>
        
        <form onSubmit={sendLink} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="input-field"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Sending link…' : 'Send Magic Link'}
          </button>
        </form>

        {sent && (
          <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-green-700 dark:text-green-300 text-sm">✅ Email sent — check your inbox!</p>
          </div>
        )}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-red-700 dark:text-red-300 text-sm">⚠️ {error}</p>
          </div>
        )}
      </div>
    </main>
  );
}
