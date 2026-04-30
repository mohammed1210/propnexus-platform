'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { isAuthEnabled } from '@/lib/auth';

type Props = {
  priceId?: string;
  productId?: string;
  children?: React.ReactNode;
  className?: string;
};

export default function UpgradeButton({ priceId, productId, children = 'Upgrade', className }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const clerk =
    isAuthEnabled && typeof window !== 'undefined'
      ? ((window as any).Clerk as undefined | { loaded?: boolean; user?: any })
      : undefined;

  const isLoaded = !isAuthEnabled || !!clerk?.loaded;
  const user = isAuthEnabled ? clerk?.user ?? null : null;

  const handleClick = async () => {
    // Wait for Clerk to load
    if (!isLoaded) {
      return;
    }

    // If not signed in, send them to sign-in page
    if (!user) {
      router.push('/sign-in?redirect_url=/pricing');
      return;
    }

    // Get user email from Clerk
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) {
      toast.error('No email address found. Please update your account.');
      return;
    }

    setLoading(true);
    try {
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, ...(priceId ? { price_id: priceId } : { product_id: productId }) }),
      });

      if (!r.ok) {
        let msg = '';
        try {
          msg = (await r.json())?.detail ?? '';
        } catch {}
        throw new Error(msg || `Checkout failed (HTTP ${r.status})`);
      }

      const data = await r.json();
      if (data?.url) {
        toast.success('Redirecting to Stripe Checkout…');
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || !isLoaded}
      className={
        className ?? 'btn-primary w-full'
      }
      aria-busy={loading}
    >
      {loading ? 'Redirecting…' : children}
    </button>
  );
}
