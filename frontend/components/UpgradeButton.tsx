'use client';

import { useState } from 'react';

type Props = {
  priceId: string;
  children?: React.ReactNode;
};

export default function UpgradeButton({ priceId, children }: Props) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    try {
      setLoading(true);
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Checkout failed (${res.status})`);
      }

      const { url } = (await res.json()) as { url?: string };
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
    >
      {loading ? 'Redirecting…' : children ?? 'Upgrade'}
    </button>
  );
}
