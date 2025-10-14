"use client";
import { useState } from 'react';

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url; // playwright asserts checkout.stripe.com
      } else if (data?.error) {
        console.error('Failed to create checkout session:', data.error);
      }
    } catch (e) {
      console.error('Unexpected error during checkout', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-8 max-w-xl mx-auto text-center">
      <h1 className="text-3xl font-bold mb-4">Pricing</h1>
      <p className="mb-6">Upgrade to unlock analytics and export your saved deals.</p>
      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Upgrade'}
      </button>
    </main>
  );
}
