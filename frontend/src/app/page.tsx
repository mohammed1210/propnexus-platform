// src/app/page.tsx
'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import NextDynamic from 'next/dynamic';

import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import PropertyCard from '@/components/PropertyCard';
import { getSupabase } from '@/lib/supabaseClient';

// Leaflet bits (client-only)
const MapContainer = NextDynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = NextDynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = NextDynamic(
  () => import('react-leaflet').then((m) => m.Marker),
  { ssr: false }
);

// ──────────────────────────────────────────────────────────────────────────────
// Types
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

// ──────────────────────────────────────────────────────────────────────────────

export default function ListingsPage() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // simple client-side filters
  const [query, setQuery] = useState('');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [minBeds, setMinBeds] = useState<number | ''>('');
  const [sortKey, setSortKey] = useState<'newest' | 'priceAsc' | 'priceDesc'>('newest');

  // Fetch initial list
  useEffect(() => {
    let ignore = false;
    const sb = getSupabase();

    (async () => {
      setLoading(true);
      const { data, error } = await sb
        .from('properties')
        .select(
          'id, title, location, price, bedrooms, bathrooms, yield_percent, roi_percent, imageurl, latitude, longitude, created_at'
        )
        .limit(60)
        .order('created_at', { ascending: false });

      if (!ignore) {
        if (error) console.error('fetch properties error', error);
        setItems((data as Property[]) ?? []);
        setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  // Filter + sort
  const filtered = useMemo(() => {
    let rows = items.slice();

    // text query (title or location)
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.location?.toLowerCase().includes(q)
      );
    }

    // numeric filters
    rows = rows.filter((p) => {
      const priceOk =
        (minPrice === '' || (p.price ?? Infinity) >= Number(minPrice)) &&
        (maxPrice === '' || (p.price ?? -Infinity) <= Number(maxPrice));
      const bedsOk = minBeds === '' || (p.bedrooms ?? 0) >= Number(minBeds);
      return priceOk && bedsOk;
    });

    // sorting
    rows.sort((a, b) => {
      if (sortKey === 'priceAsc') return (a.price ?? 0) - (b.price ?? 0);
      if (sortKey === 'priceDesc') return (b.price ?? 0) - (a.price ?? 0);
      // newest (fallback — the DB query already orders by created_at desc)
      return 0;
    });

    return rows;
  }, [items, query, minPrice, maxPrice, minBeds, sortKey]);

  // Map points
  const points = useMemo(
    () =>
      filtered
        .filter(
          (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
        )
        .map((p) => ({
          id: p.id ?? '',
          title: p.title,
          lat: Number(p.latitude),
          lng: Number(p.longitude),
        })),
    [filtered]
  );

  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lng]
    : [51.5072, -0.1276]; // London fallback

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      {/* Page header */}
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Listings</h1>
          <p className="text-slate-600">Fresh opportunities from the feed.</p>
        </div>
      </header>

      {/* 🔎 Sticky search & filters */}
      <div className="sticky top-14 z-10 -mx-4 px-4 py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <form
          className="grid grid-cols-2 md:grid-cols-6 gap-3"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            className="md:col-span-2 rounded-md border px-3 py-2 text-sm outline-none border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            placeholder="Search by title or location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <input
            className="rounded-md border px-3 py-2 text-sm outline-none border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            type="number"
            min={0}
            placeholder="Min £"
            value={minPrice}
            onChange={(e) =>
              setMinPrice(e.target.value === '' ? '' : Number(e.target.value))
            }
          />
          <input
            className="rounded-md border px-3 py-2 text-sm outline-none border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            type="number"
            min={0}
            placeholder="Max £"
            value={maxPrice}
            onChange={(e) =>
              setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))
            }
          />
          <input
            className="rounded-md border px-3 py-2 text-sm outline-none border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            type="number"
            min={0}
            placeholder="Min beds"
            value={minBeds}
            onChange={(e) =>
              setMinBeds(e.target.value === '' ? '' : Number(e.target.value))
            }
          />

          <select
            className="rounded-md border px-3 py-2 text-sm outline-none border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
          >
            <option value="newest">Newest</option>
            <option value="priceAsc">Price ↑</option>
            <option value="priceDesc">Price ↓</option>
          </select>
        </form>
      </div>

      {/* Map (only when we have coordinates) */}
      {points.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <MapContainer
            style={{ height: 360, width: '100%' }}
            center={center}
            zoom={11}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]} />
            ))}
          </MapContainer>
        </div>
      )}

      {/* Grid */}
      <Section>
        <SectionTitle>Latest Properties</SectionTitle>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 p-4 h-48 bg-slate-50 dark:bg-slate-900/40"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-slate-500">No properties match your filters.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((p) => (
              <PropertyCard key={p.id ?? `${p.title}-${Math.random()}`} property={p} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}