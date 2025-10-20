'use client';

import { useState } from 'react';

export default function UpgradeButton({
  email,
  className,
  children = 'Upgrade',
}: {
  email?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

  const onClick = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          success_url: `${window.location.origin}/success`,
          cancel_url: `${window.location.origin}/pricing`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      console.error('Upgrade failed', e);
      alert(`Upgrade failed: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={className ?? 'px-4 py-2 rounded bg-cyan-600 text-white'}
    >
      {loading ? 'Redirecting…' : children}
    </button>
  );
}
