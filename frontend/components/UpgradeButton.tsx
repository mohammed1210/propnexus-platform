'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/** Lazy Supabase (safe for CI/preview) */
async function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key);
}

async function getUserEmail(): Promise<string | null> {
  try {
    const sb = await getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getUser();
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

type Props = {
  priceId: string;
  children?: React.ReactNode;
  className?: string;
};

export default function UpgradeButton({ priceId, children = 'Upgrade', className }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => setEmail(await getUserEmail()))();
  }, []);

  const handleClick = async () => {
    // If not signed in, send them to magic login and back to pricing
    if (!email) {
      router.push('/magic-login?returnTo=/pricing');
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
        try { msg = (await r.json())?.detail ?? ''; } catch {}
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
      disabled={loading}
      className={
        className ??
        `inline-flex items-center justify-center rounded-md bg-zinc-900 text-white px-4 py-2
         hover:bg-zinc-800 disabled:opacity-60`
      }
    >
      {loading ? 'Redirecting…' : children}
    </button>
  );
}
