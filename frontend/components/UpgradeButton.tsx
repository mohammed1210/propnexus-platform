'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

async function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key);
}
async function getUserEmail(): Promise<string | null> {
  try {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export default function UpgradeButton({
  priceId,
  children,
}: {
  priceId: string;
  children?: React.ReactNode;
}) {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { (async () => setEmail(await getUserEmail()))(); }, []);

  const startCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_id: priceId,
          email: email ?? undefined, // backend can still create customer without it
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      if (data?.url) {
        toast.success('Redirecting to Stripe…');
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Checkout failed.');
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
      {loading ? 'Redirecting…' : children ?? 'Upgrade'}
    </button>
  );
}
