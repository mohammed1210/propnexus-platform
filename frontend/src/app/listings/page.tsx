// src/app/listings/page.tsx
'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import PropertyCard from '@/components/PropertyCard';
import { getSupabase } from '@/lib/supabaseClient';

import NextDynamic from 'next/dynamic';
import type { Map as LeafletMap, LatLngBoundsExpression } from 'leaflet';

const MapContainer = NextDynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer    = NextDynamic(() => import('react-leaflet').then(m => m.TileLayer),    { ssr: false });
const Marker       = NextDynamic(() => import('react-leaflet').then(m => m.Marker),       { ssr: false });
const Popup        = NextDynamic(() => import('react-leaflet').then(m => m.Popup),        { ssr: false });

// ---------- Types ----------
type RawProperty = {
  id: string | null;
  title: string | null;
  location: string | null;
  price: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

// ---------- ClientMap (stable single instance) ----------
function ClientMap({
  points,
  defaultCenter,
}: {
  points: { id: string; title: string; lat: number; lng: number; price?: number }[];
  defaultCenter: [number, number];
}) {
  const [mounted, setMounted] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => setMounted(true), []);

  const fitToPoints = (m: LeafletMap, pts: typeof points) => {
    if (!pts.length) return;
    const bounds: LatLngBoundsExpression = pts.map(p => [p.lat, p.lng]) as LatLngBoundsExpression;
    m.fitBounds(bounds, { padding: [24, 24] });
  };

  const handleReady = (m: LeafletMap) => {
    mapRef.current = m;
    if (points.length) fitToPoints(m, points);
    else m.setView(defaultCenter, 6);
  };

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (points.length) fitToPoints(m, points);
    else m.setView(defaultCenter, 6);
  }, [points, defaultCenter]);

  const mapOnce = useMemo(() => {
    if (!mounted) return null;
    return (
      <MapContainer
        // @ts-ignore – react-leaflet forwards the Leaflet Map instance here at runtime
        ref={handleReady}
        center={defaultCenter}
        zoom={6}
        scrollWheelZoom={false}
        style={{ height: 360, width: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map(p => (
          <Marker key={p.id} position={[p.lat, p.lng]}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{p.title}</div>
                {p.price != null && (
                  <div className="text-slate-600">£{p.price.toLocaleString()}</div>
                )}
                <a
                  href={`/property/${p.id}`}
                  className="inline-block mt-1 underline text-blue-600 hover:text-blue-700"
                >
                  View details →
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    );
  }, [mounted, points, defaultCenter]);

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
      {mapOnce}
    </div>
  );
}

// ---------- Page ----------
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

  const [items, setItems] = useState<RawProperty[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [minBeds,  setMinBeds]  = useState<number | undefined>(undefined);

  // Seed filters from URL
  useEffect(() => {
    const qp  = searchParams?.get('q')   ?? '';
    const mi  = searchParams?.get('min');
    const ma  = searchParams?.get('max');
    const bed = searchParams?.get('beds');
    if (qp) setQ(qp);
    if (mi) setMinPrice(Number(mi));
    if (ma) setMaxPrice(Number(ma));
    if (bed) setMinBeds(Number(bed));
  }, [searchParams]);

  // Push filter changes
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

  // Fetch properties
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
        if (error) console.warn('load properties', error);
        setItems((data as RawProperty[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  // Apply filters
  const filtered = useMemo(() => {
    return items.filter(p => {
      const title = p.title ?? '';
      const loc   = p.location ?? '';
      const titleMatch = q
        ? (title.toLowerCase().includes(q.toLowerCase()) ||
           loc.toLowerCase().includes(q.toLowerCase()))
        : true;

      const price = Number(p.price ?? 0);
      const priceOK =
        (minPrice == null || price >= minPrice) &&
        (maxPrice == null || price <= maxPrice);

      const bedsOK = (minBeds == null || (p.bedrooms ?? 0) >= minBeds);
      return titleMatch && priceOK && bedsOK;
    });
  }, [items, q, minPrice, maxPrice, minBeds]);

  // Map points
  const points = useMemo(
    () =>
      filtered
        .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .map((p, i) => ({
          id: String(p.id ?? `idx-${i}`),
          title: p.title ?? '',
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          price: Number(p.price ?? 0),
        })),
    [filtered]
  );

  const defaultCenter: [number, number] = points.length
    ? [points[0].lat, points[0].lng]
    : [51.5072, -0.1276];

  const clearAll = () => {
    setQ('');
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setMinBeds(undefined);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Listings</h1>
        <p className="text-slate-600">Fresh opportunities from the feed.</p>
      </header>

      {/* Filters */}
      <div className="sticky top-12 md:top-16 z-40 -mx-4 px-4 py-2 md:py-3
                   bg-white dark:bg-slate-900
                   supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:backdrop-blur
                   border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-3 items-center">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title or location…" className="h-9 md:h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 md:px-3 text-[13px] md:text-sm" />
          <input type="number" inputMode="numeric" placeholder="Min £" value={minPrice ?? ''} onChange={e => setMinPrice(e.target.value ? Number(e.target.value) : undefined)} className="h-9 md:h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 md:px-3 text-[13px] md:text-sm" />
          <input type="number" inputMode="numeric" placeholder="Max £" value={maxPrice ?? ''} onChange={e => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)} className="h-9 md:h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 md:px-3 text-[13px] md:text-sm" />
          <select value={minBeds ?? ''} onChange={e => setMinBeds(e.target.value ? Number(e.target.value) : undefined)} className="h-9 md:h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 md:px-3 text-[13px] md:text-sm">
            <option value="">Min beds</option>
            <option value="1">1+ bed</option>
            <option value="2">2+ beds</option>
            <option value="3">3+ beds</option>
            <option value="4">4+ beds</option>
          </select>
          <button onClick={clearAll} className="h-9 md:h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-2.5 md:px-3 text-[13px] md:text-sm" title="Clear filters">Clear</button>
        </div>
      </div>

<<<<<<< HEAD
      {/* 🗺️ Map */}
      {points.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <MapContainer
            ref={mapRef as any}           // react-leaflet forwards ref to Leaflet Map
            style={{ height: 360, width: '100%' }}
            center={center}
            zoom={6}

            whenReady={handleMapReady}    // () => void ✔️
          >
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map(p => (
              <Marker key={p.id} position={[p.lat, p.lng]}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">{p.title}</div>
                    {p.price != null && (
                      <div className="text-slate-600">£{p.price.toLocaleString()}</div>
                    )}
                    <a
                      href={`/property/${p.id}`}
                      className="inline-block mt-1 underline text-blue-600 hover:text-blue-700"
                    >
                      View details →
                    </a>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
=======
      {/* Map */}
      <ClientMap points={points} defaultCenter={defaultCenter} />
>>>>>>> e766067 (fix: stable map + ts-ignore)

      {/* Cards */}
      <Section>
        <SectionTitle>Latest Properties</SectionTitle>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 p-4 h-48 bg-slate-50 dark:bg-slate-800/40" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <p className="text-slate-600 dark:text-slate-300 mb-2">No properties match the current filters.</p>
            <button onClick={clearAll} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((p, i) => (
              <PropertyCard
                key={p.id ?? `card-${i}`}
                property={{
                  id: String(p.id ?? `card-${i}`),
                  title: p.title ?? '',
                  location: p.location ?? '',
                  price: Number(p.price ?? 0),
                  bedrooms: p.bedrooms ?? null,
                  bathrooms: p.bathrooms ?? null,
                  yield_percent: p.yield_percent ?? null,
                  roi_percent: p.roi_percent ?? null,
                  imageurl: p.imageurl ?? null,
                }}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}