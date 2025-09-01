'use client';

import { useEffect, useState } from 'react';
import PropertyCard from '@/components/PropertyCard';
import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import { getSupabase } from '@/lib/supabaseClient';

type Property = {
  id: string | null;
  title: string;
  location: string;
  price: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
};

export default function ListingsPage() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    let sb;
    try { sb = getSupabase(); } catch { return; } // skip during SSR

    (async () => {
      setLoading(true);
      const { data, error } = await sb
        .from('properties')
        .select('id, title, location, price, bedrooms, bathrooms, yield_percent, roi_percent, imageurl')
        .limit(24);

      if (!ignore) {
        if (error) console.error('fetch properties error', error);
        setItems((data as Property[]) ?? []);
        setLoading(false);
      }
    })();

    return () => { ignore = true; };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Listings</h1>
        <p className="text-slate-600">Fresh opportunities from the feed.</p>
      </header>

      <Section>
        <SectionTitle>Latest Properties</SectionTitle>
        {loading ? (
          <p className="p-3 text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-3 text-slate-500">No properties found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map(p => <PropertyCard key={p.id ?? Math.random()} property={p} />)}
          </div>
        )}
      </Section>
    </div>
  );
}