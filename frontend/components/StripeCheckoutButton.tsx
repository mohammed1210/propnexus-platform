'use client';

import { useState } from 'react';
import { toast } from 'sonner';

type Props = {
  priceId: string; // Stripe Price ID
  email?: string | null; // optional (we’ll also try to read server-side if needed)
  successUrl?: string; // optional override
  cancelUrl?: string; // optional override
  label?: string; // button text
};

export default function StripeCheckoutButton({
  priceId,
  email,
  successUrl,
  cancelUrl,
  label = 'Upgrade',
}: Props) {
  const [loading, setLoading] = useState(false);

  const startCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_id: priceId,
          email: email ?? undefined,
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);

      if (data?.url) {
        toast.success('Redirecting to secure checkout…');
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Checkout failed (bad request).');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={startCheckout}
      disabled={loading}
      className={`inline-flex items-center justify-center px-4 py-2 rounded-md font-medium transition
        ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary/90'}
        bg-primary text-white`}
    >
      {loading ? 'Redirecting…' : label}
    </button>
  );
}
