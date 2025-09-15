'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import PropertyCard from '@/components/PropertyCard';
import { getSupabase } from '@/lib/supabaseClient';

type SavedDeal = {
  id: string;
  property_id?: string | null;
  title?: string | null;
  location?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
  created_at?: string | null;
};

export default function SavedDealsPage() {
  const [deals, setDeals] = useState<SavedDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    let sb: ReturnType<typeof getSupabase>;
    try {
      sb = getSupabase();
    } catch {
      return;
    }

    (async () => {
      setLoading(true);
      const { data, error } = await sb
        .from('saved_deals')
        .select('id, property_id, title, location, price, bedrooms, bathrooms, yield_percent, roi_percent, imageurl, created_at')
        .order('created_at', { ascending: false });

      // …inside the useEffect where we load saved_deals…
      if (!ignore) {
        if (error) console.warn('load saved_deals', error); // ⬅️ was console.error
        setDeals((data as SavedDeal[]) ?? []);
        setLoading(false);
      }
    })();

    return () => { ignore = true; };
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Saved Deals</h1>
        <p className="text-slate-600">Properties you’ve bookmarked.</p>
      </header>

      <Section>
        <SectionTitle>Saved Properties</SectionTitle>

        {loading ? (
          <p className="p-3 text-slate-500">Loading…</p>
        ) : deals.length === 0 ? (
          <p className="p-3 text-slate-500">You haven’t saved any deals yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {deals.map((d) => (
              <PropertyCard
                key={d.id}
                p={{
                  id: String(d.property_id ?? d.id),
                  title: d.title ?? '',
                  location: d.location ?? '',
                  price: Number(d.price ?? 0),
                  bedrooms: d.bedrooms ?? null,
                  bathrooms: d.bathrooms ?? null,
                  yield_percent: d.yield_percent ?? null,
                  roi_percent: d.roi_percent ?? null,
                  imageurl: d.imageurl ?? null,
                }}
              />
            ))}
          </div>
        )}
      </Section>
    </main>
  );
}
