// This file implements the `/success` page for the PropNexus platform.  It
// handles sending a Supabase magic‑link to the user after they return from
// checkout.  Users must enter the email address they used at checkout and
// press the button to receive their login link.  If the link is sent
// successfully a confirmation message is displayed.

'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

/**
 * SuccessPage prompts the user to enter their e‑mail address and sends a
 * Supabase magic link when submitted.  This page should be shown as the
 * redirect URL after Stripe checkout.
 */
export default function SuccessPage() {
  const supabase = getSupabase();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      if (!email) {
        setError('Please enter your e‑mail address.');
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Redirect back to the home page after the user clicks the link.
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (signInError) {
        setError(signInError.message);
      } else {
        setSent(true);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send magic link.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Payment Successful</h1>
      {!sent ? (
        <>
          <p className="mb-4">
            Thank you for subscribing! To complete your account setup please enter the email address
            you used during checkout. We will send you a one‑time login link.
          </p>
          <form onSubmit={handleSend} className="space-y-4">
            <input
              type="email"
              className="w-full border border-neutral-300 dark:border-neutral-700 rounded px-3 py-2"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <button
              type="submit"
              disabled={sending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded px-4 py-2 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send Magic Link'}
            </button>
          </form>
        </>
      ) : (
        <p>
          A sign‑in link has been sent to <strong>{email}</strong>. Please check your inbox and
          follow the instructions to log in.
        </p>
      )}
    </div>
  );
}
