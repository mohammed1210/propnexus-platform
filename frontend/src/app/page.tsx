'use client';
export const dynamic = 'force-dynamic';

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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2 text-slate-600">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}

function safeAvg(nums: number[]) {
  const arr = nums.filter((n) => Number.isFinite(n));
  if (!arr.length) return 0;
  const v = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Number(v.toFixed(2));
}
function formatGBP(n: number) {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString();
}
function formatDate(s?: string | null) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString(); } catch { return '—'; }
}