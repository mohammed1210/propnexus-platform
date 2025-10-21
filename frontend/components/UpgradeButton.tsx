'use client';

import * as React from 'react';
import { startCheckout } from '@/lib/stripe';

type Props = {
  priceId: string;
  email?: string | null;
  className?: string;
  children?: React.ReactNode;
};

export default function UpgradeButton({ priceId, email, className, children }: Props) {
  const [loading, setLoading] = React.useState(false);
  return (
    <button
      className={className || 'px-4 py-2 rounded bg-black text-white'}
      disabled={loading}
      onClick={async () => {
        try {
          setLoading(true);
          const { url } = await startCheckout({ priceId, email: email || undefined });
          window.location.href = url;
        } catch (e) {
          console.error(e);
          alert('Unable to start checkout right now.');
        } finally {
          setLoading(false);
        }
      }}
    >
      {children || (loading ? 'Loading…' : 'Upgrade')}
    </button>
  );
}
