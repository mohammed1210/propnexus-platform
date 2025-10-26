'use client';

import React, { useState } from 'react';
import { fetchWithRetry } from '@/lib/api';

export default function UpgradeButton() {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    try {
      setLoading(true);
      const res = await fetchWithRetry(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/billing/create-checkout-session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: 'premium' }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      console.error(e);
      alert('Unable to start checkout.');
      setLoading(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-60"
    >
      {loading ? 'Redirecting…' : 'Upgrade to Premium'}
    </button>
  );
}
