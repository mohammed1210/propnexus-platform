'use client';

import { useState } from 'react';

export const metadata = { title: 'Manage Subscription • PropNexus' };

export default function BillingAccountPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function openPortal() {
    try {
      setErr(null);
      setLoading(true);

      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data: { ok: boolean; url?: string; error?: string } = await res.json();

      if (data.ok && data.url) {
        window.location.href = data.url;
      } else {
        setErr(data.error || 'Could not open customer portal.');
      }
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong opening the portal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold mb-4">Manage your subscription</h1>
      <p className="opacity-70 mb-8">
        Update payment method, change plan, or cancel anytime in the secure Stripe
        Customer Portal.
      </p>

      {err && (
        <p className="mb-6 text-sm text-red-600">
          {err}
        </p>
      )}

      <button
        className="btn"
        onClick={openPortal}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? 'Opening Portal…' : 'Open Customer Portal'}
      </button>

      <div className="mt-8">
        <a href="/pricing" className="underline opacity-70 hover:opacity-100">
          Back to Pricing
        </a>
      </div>
    </main>
  );
}
