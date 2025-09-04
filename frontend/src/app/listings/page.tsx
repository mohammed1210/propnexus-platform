// src/app/listings/page.tsx
'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import PropertyCard from '@/components/PropertyCard';
import { getSupabase } from '@/lib/supabaseClient';

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
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <ListingsInner />
    </Suspense>
  );
}

function ListingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // UI filters
  const [q, setQ] = useState('');
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [minBeds,  setMinBeds]  = useState<number | undefined>();

  // 1) seed filters from URL once
  useEffect(() => {
    const qp  = searchParams?.get('q')   ?? '';
    const mi  = searchParams?.get('min');
    const ma  = searchParams?.get('max');
    const bed = searchParams?.get('beds');
    if (qp) setQ(qp);
    if (mi) setMinPrice(Number(mi));
    if (ma) setMaxPrice(Number(ma));
    if (bed) setMinBeds(Number(bed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) push filter changes back to URL (debounced)
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const p = new URLSearchParams();
      if (q.trim()) p.set('q', q.trim());
      if (minPrice != null) p.set('min', String(minPrice));
      if (maxPrice != null) p.set('max', String(maxPrice));
      if (minBeds  != null) p.set('beds', String(minBeds));
      router.replace(`/listings${p.toString() ? `?${p.toString()}` : ''}`);
    }, 250);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [q, minPrice, maxPrice, minBeds, router]);

  // 3) fetch properties
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

  // 4) apply filters
  const filtered = useMemo(() => {
    return items.filter(p => {
      const titleMatch = q
        ? (p.title?.toLowerCase().includes(q.toLowerCase()) ||
           p.location?.toLowerCase().includes(q.toLowerCase()))
        : true;

      const priceOK =
        (minPrice == null || (p.price ?? 0) >= minPrice) &&
        (maxPrice == null || (p.price ?? 0) <= maxPrice);

      const bedsOK = (minBeds == null || (p.bedrooms ?? 0) >= minBeds);
      return titleMatch && priceOK && bedsOK;
    });
  }, [items, q, minPrice, maxPrice, minBeds]);

  // 5) markers + default center
  const points = useMemo(
    () =>
      filtered
        .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .map(p => ({ id: p.id ?? '', title: p.title, lat: Number(p.latitude), lng: Number(p.longitude) })),
    [filtered]
  );

  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lng]
    : [53.8, -1.6]; // UK-ish centre

  const clearAll = () => {
    setQ('');
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setMinBeds(undefined);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-[clamp(1.5rem,3.5vw,2rem)] font-extrabold tracking-tight">Listings</h1>
        <p className="text-slate-600">Fresh opportunities from the feed.</p>
      </header>

      {/* 🔎 Sticky filters */}
      <div
        className="sticky top-0 z-30 -mx-4 px-4 py-3
                   bg-white/85 dark:bg-slate-900/85 backdrop-blur supports-[backdrop-filter]:backdrop-blur
                   border-b border-slate-200 dark:border-slate-800"
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search title or location…"
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3"
            aria-label="Search title or location"
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Min £"
            value={minPrice ?? ''}
            onChange={e => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3"
            aria-label="Minimum price"
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Max £"
            value={maxPrice ?? ''}
            onChange={e => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3"
            aria-label="Maximum price"
          />
          <select
            value={minBeds ?? ''}
            onChange={e => setMinBeds(e.target.value ? Number(e.target.value) : undefined)}
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3"
            aria-label="Minimum bedrooms"
          >
            <option value="">Min beds</option>
            <option value="1">1+ bed</option>
            <option value="2">2+ beds</option>
            <option value="3">3+ beds</option>
            <option value="4">4+ beds</option>
          </select>

          <button
            onClick={clearAll}
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-3"
            title="Clear filters"
          >
            Clear
          </button>
        </div>

        {/* tiny status row */}
        <div className="mt-2 text-xs text-slate-500">
          {loading ? 'Loading…' : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
        </div>
      </div>

      {/* 🗺️ Map */}
      {points.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <MapContainer
            style={{ height: 360, width: '100%' }}
            center={center}
            zoom={6}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map(p => (
              <Marker key={p.id} position={[p.lat, p.lng]} />
            ))}
          </MapContainer>
        </div>
      )}

      <Section>
        <SectionTitle>Latest Properties</SectionTitle>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 p-4 h-48 bg-slate-50 dark:bg-slate-800/40"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <p className="text-slate-600 dark:text-slate-300 mb-2">No properties match the current filters.</p>
            <button
              onClick={clearAll}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Clear filters
            </button>
          </div>
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