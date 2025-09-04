// src/app/page.tsx
'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import PropertyCard from '@/components/PropertyCard';
import { getSupabase } from '@/lib/supabaseClient';

// Avoid clashing with export const dynamic
import NextDynamic from 'next/dynamic';
const MapContainer = NextDynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer    = NextDynamic(() => import('react-leaflet').then(m => m.TileLayer),    { ssr: false });
const Marker       = NextDynamic(() => import('react-leaflet').then(m => m.Marker),       { ssr: false });

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
  latitude?: number | null;
  longitude?: number | null;
};

export default function ListingsPage() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // simple UI filters
  const [q, setQ] = useState('');
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [minBeds, setMinBeds]   = useState<number | undefined>();

  useEffect(() => {
    let ignore = false;
    const sb = getSupabase();
    (async () => {
      setLoading(true);
      const { data, error } = await sb
        .from('properties')
        .select('id, title, location, price, bedrooms, bathrooms, yield_percent, roi_percent, imageurl, latitude, longitude')
        .limit(60);

      if (!ignore) {
        if (error) console.error('fetch properties error', error);
        setItems((data as Property[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  const filtered = useMemo(() => {
    return items.filter(p => {
      const titleMatch = q ? (p.title?.toLowerCase().includes(q.toLowerCase()) || p.location?.toLowerCase().includes(q.toLowerCase())) : true;
      const priceOK = (minPrice == null || (p.price ?? 0) >= minPrice) && (maxPrice == null || (p.price ?? 0) <= maxPrice);
      const bedsOK  = (minBeds == null || (p.bedrooms ?? 0) >= minBeds);
      return titleMatch && priceOK && bedsOK;
    });
  }, [items, q, minPrice, maxPrice, minBeds]);

  const points = useMemo(
    () =>
      filtered
        .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .map(p => ({ id: p.id ?? '', title: p.title, lat: Number(p.latitude), lng: Number(p.longitude) })),
    [filtered]
  );

  const center: [number, number] = points.length ? [points[0].lat, points[0].lng] : [51.5072, -0.1276];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Listings</h1>
        <p className="text-slate-600">Fresh opportunities from the feed.</p>
      </header>

      {/* 🔎 Sticky filters bar */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search title or location…"
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3"
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Min £"
            value={minPrice ?? ''}
            onChange={e => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3"
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Max £"
            value={maxPrice ?? ''}
            onChange={e => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3"
          />
          <select
            value={minBeds ?? ''}
            onChange={e => setMinBeds(e.target.value ? Number(e.target.value) : undefined)}
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3"
          >
            <option value="">Min beds</option>
            <option value="1">1+ bed</option>
            <option value="2">2+ beds</option>
            <option value="3">3+ beds</option>
            <option value="4">4+ beds</option>
          </select>
        </div>
      </div>

      {/* 🗺️ Map (only when we have coordinates) */}
      {points.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <MapContainer style={{ height: 360, width: '100%' }} center={center} zoom={11} scrollWheelZoom={false}>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {points.map(p => <Marker key={p.id} position={[p.lat, p.lng]} />)}
          </MapContainer>
        </div>
      )}

      <Section>
        <SectionTitle>Latest Properties</SectionTitle>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 p-4 h-48 bg-slate-50 dark:bg-slate-800/40" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-slate-500">No properties match the current filters.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(p => (
              <PropertyCard key={p.id ?? `${p.title}-${Math.random()}`} property={p} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}