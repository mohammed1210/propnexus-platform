'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';

type Props = {
  priceId: string;
  children?: React.ReactNode;
  className?: string;
};

export default function UpgradeButton({ priceId, children = 'Upgrade', className }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Try to use Clerk, fallback if not available
  let user: any = null;
  let isLoaded = true;

  try {
    const clerkHook = useUser();
    user = clerkHook.user;
    isLoaded = clerkHook.isLoaded;
  } catch (error) {
    console.warn('[UpgradeButton] Clerk not available:', error);
    isLoaded = true; // Treat as loaded but without user
  }

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
        body: JSON.stringify({ email, price_id: priceId }),
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
