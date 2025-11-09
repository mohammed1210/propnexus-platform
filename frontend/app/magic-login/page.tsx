'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { FiMail, FiShield, FiLock, FiCheck } from 'react-icons/fi';

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
    <main className="flex items-center justify-center min-h-screen px-6 py-12">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <div
          className="rounded-xl p-8 backdrop-blur-md shadow-xl"
          style={{
            background: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            border: '1px solid',
          }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
              style={{ background: 'var(--accent-gradient)' }}
            >
              <FiMail className="text-white" size={28} />
            </div>
            <h1
              className="text-2xl font-bold mb-2 bg-gradient-to-r bg-clip-text"
              style={{
                backgroundImage: 'var(--accent-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Welcome to PropNexus
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Sign in with a magic link — no password needed
            </p>
          </div>

          {/* Form or Success State */}
          {!sent ? (
            <form onSubmit={sendLink} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="input-field w-full"
                  style={{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-white font-semibold rounded-lg transition-all duration-300"
                style={{ background: loading ? 'var(--text-muted)' : 'var(--accent-gradient)' }}
              >
                {loading ? 'Sending link…' : 'Send Magic Link'}
              </button>

              {error && (
                <div
                  className="p-4 rounded-lg text-sm"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'var(--error)',
                    border: '1px solid',
                    color: 'var(--error)',
                  }}
                >
                  ⚠️ {error}
                </div>
              )}
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-2"
                style={{ background: 'rgba(16, 185, 129, 0.1)' }}
              >
                <FiCheck style={{ color: 'var(--success)' }} size={32} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                Check your email!
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                We&apos;ve sent a magic link to <strong>{email}</strong>
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Click the link in your email to sign in. The link expires in 1 hour.
              </p>
            </div>
          )}
        </div>

        {/* Trust Footer */}
        <div
          className="mt-6 p-4 rounded-lg text-center backdrop-blur-sm"
          style={{
            background: 'var(--surface-subtle)',
            borderColor: 'var(--border-secondary)',
            border: '1px solid',
          }}
        >
          <div className="flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <FiShield size={14} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ color: 'var(--text-muted)' }}>Secure authentication</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FiLock size={14} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ color: 'var(--text-muted)' }}>End-to-end encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
