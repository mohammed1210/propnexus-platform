'use client';

import { useState } from 'react';

type Props = {
  priceId: string;
  children?: React.ReactNode;
  className?: string;
};

export default function UpgradeButton({ priceId, children, className }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!priceId) {
      alert('Missing priceId');
      return;
    }
    try {
      setLoading(true);

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The API validates this priceId against NEXT_PUBLIC_STRIPE_ALLOWED_PRICE_IDS
        body: JSON.stringify({ priceId }),
      });

      // Attempt to parse the JSON either way to get a useful error
      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        console.error('Checkout error', data);
        alert(data?.error || 'Checkout failed (bad request).');
        return;
      }

      if (data?.url) {
        window.location.href = data.url as string; // Redirect to Stripe Checkout
      } else {
        alert('Checkout failed: no redirect URL returned.');
      }
    } catch (err) {
      console.error('Checkout exception', err);
      alert('Checkout failed (network/client error).');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={
        className ??
        'w-full rounded-md bg-black text-white px-4 py-2 disabled:opacity-60 disabled:cursor-not-allowed'
      }
    >
      {loading ? 'Redirecting…' : children ?? 'Upgrade'}
    </button>
  );
}
