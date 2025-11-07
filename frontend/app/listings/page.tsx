'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import type { Map as LeafletMap, LatLngBoundsExpression } from 'leaflet';
import { FiSearch } from 'react-icons/fi';
import { LuPoundSterling, LuBedDouble, LuBath } from 'react-icons/lu';

import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import PropertyCard from '@/components/PropertyCard';
import { getSupabase } from '@/lib/supabaseClient';

/* ---------------- Helper Functions ---------------- */
/**
 * Parse a string to a positive integer.
 * Returns undefined if the value is blank, NaN, or <= 0.
 */
function parsePositiveInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  if (isNaN(num) || num <= 0) return undefined;
  return Math.floor(num);
}

/**
 * Sanitize search query to prevent special character issues.
 * Escapes % and , characters, and limits length to 64 chars.
 */
function sanitizeSearch(q: string): string {
  if (!q) return '';
  // Replace % and , with spaces to avoid query issues
  const sanitized = q.replace(/[%,]/g, ' ').trim();
  // Limit to 64 characters
  return sanitized.slice(0, 64);
}

const MapContainer = nextDynamic(() => import('react-leaflet').then((m) => m.MapContainer), {
  ssr: false,
});
const TileLayer = nextDynamic(() => import('react-leaflet').then((m) => m.TileLayer), {
  ssr: false,
});
const Marker = nextDynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = nextDynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });

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
  created_at?: string | null;
};

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <ListingsInner />
    </Suspense>
  );
}

/* ---------------- Map ---------------- */
function ClientMap({
  points,
  defaultCenter,
}: {
  points: { id: string; title: string; lat: number; lng: number; price?: number }[];
  defaultCenter: [number, number];
}) {
  const mapRef = useRef<LeafletMap | null>(null);

  // Load Leaflet CSS dynamically
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }
  }, []);

  const fit = (m: LeafletMap, pts: { lat: number; lng: number }[]) => {
    if (!pts.length) return;
    const bounds: LatLngBoundsExpression = pts.map((p) => [p.lat, p.lng]) as any;
    m.fitBounds(bounds, { padding: [24, 24] });
  };

  const setMap = (instance: LeafletMap | null) => {
    if (!instance) return;
    mapRef.current = instance;
    if (points.length) fit(instance, points);
    else instance.setView(defaultCenter, 6);
  };

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (points.length) fit(m, points);
    else m.setView(defaultCenter, 6);
    return () => {
      try {
        m.remove();
      } catch {}
      mapRef.current = null;
    };
  }, [points, defaultCenter]);

  return (
    <MapContainer
      key="map-root"
      ref={setMap as any}
      center={defaultCenter}
      zoom={6}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
      scrollWheelZoom={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
        minZoom={3}
        tileSize={256}
        zoomOffset={0}
      />
      {points.map((p) => (
        <Marker key={p.id} position={{ lat: p.lat, lng: p.lng }}>
          <Popup>
            <div className="text-sm font-medium">{p.title}</div>
            {typeof p.price === 'number' && (
              <div className="text-xs opacity-70">£{p.price.toLocaleString()}</div>
            )}
            <div className="mt-1">
              <Link href={`/property/${p.id}`} className="underline text-xs">
                View details
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

/* ---------------- Filters (with Sort) ---------------- */
const SORTABLE = ['created_at', 'price', 'bedrooms', 'roi_percent', 'yield_percent'] as const;
type SortKey = (typeof SORTABLE)[number];

function FiltersBar() {
  const sp = useSearchParams();
  const router = useRouter();

  const qInit = sp?.get('q') ?? '';
  const minInit = sp?.get('min') ?? '';
  const maxInit = sp?.get('max') ?? '';
  const bedsInit = sp?.get('beds') ?? '';
  const bathsInit = sp?.get('baths') ?? '';
  const sortInit = (sp?.get('sort') as SortKey) || 'created_at';
  const dirInit = sp?.get('dir') === 'asc' ? 'asc' : 'desc';

  const [q, setQ] = useState(qInit);
  const [min, setMin] = useState(minInit);
  const [max, setMax] = useState(maxInit);
  const [beds, setBeds] = useState(bedsInit);
  const [baths, setBaths] = useState(bathsInit);
  const [sort, setSort] = useState<SortKey>(sortInit);
  const [dir, setDir] = useState<'asc' | 'desc'>(dirInit);

  const apply = () => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (min) p.set('min', min);
    if (max) p.set('max', max);
    if (beds) p.set('beds', beds);
    if (baths) p.set('baths', baths);
    if (sort) p.set('sort', sort);
    if (dir) p.set('dir', dir);
    router.push(`/listings?${p.toString()}`);
  };

  const reset = () => {
    setQ('');
    setMin('');
    setMax('');
    setBeds('');
    setBaths('');
    setSort('created_at');
    setDir('desc');
    router.push('/listings');
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-9 gap-2" role="search" aria-label="Property filters">
      <div className="col-span-2 flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
        <FiSearch className="opacity-60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search area, title, or postcode"
          className="w-full bg-transparent outline-none"
          aria-label="Search properties"
        />
      </div>

      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
        <LuPoundSterling className="opacity-60" />
        <input
          value={min}
          onChange={(e) => setMin(e.target.value)}
          placeholder="Min"
          inputMode="numeric"
          className="w-full bg-transparent outline-none"
          aria-label="Minimum price"
        />
      </div>

      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
        <LuPoundSterling className="opacity-60" />
        <input
          value={max}
          onChange={(e) => setMax(e.target.value)}
          placeholder="Max"
          inputMode="numeric"
          className="w-full bg-transparent outline-none"
          aria-label="Maximum price"
        />
      </div>

      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
        <LuBedDouble className="opacity-60" />
        <input
          value={beds}
          onChange={(e) => setBeds(e.target.value)}
          placeholder="Beds"
          inputMode="numeric"
          className="w-full bg-transparent outline-none"
          aria-label="Minimum bedrooms"
        />
      </div>

      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
        <LuBath className="opacity-60" />
        <input
          value={baths}
          onChange={(e) => setBaths(e.target.value)}
          placeholder="Baths"
          inputMode="numeric"
          className="w-full bg-transparent outline-none"
          aria-label="Minimum bathrooms"
        />
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
        <select
          value={sort}
          onChange={(e) => setSort((e.target.value as SortKey) || 'created_at')}
          className="w-full bg-transparent outline-none"
          aria-label="Sort field"
        >
          <option value="created_at">Newest</option>
          <option value="price">Price</option>
          <option value="bedrooms">Bedrooms</option>
          <option value="roi_percent">ROI %</option>
          <option value="yield_percent">Yield %</option>
        </select>
      </div>

      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
        <select
          value={dir}
          onChange={(e) => setDir(e.target.value === 'asc' ? 'asc' : 'desc')}
          className="w-full bg-transparent outline-none"
          aria-label="Sort direction"
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </div>

      <div className="flex gap-2">
        <button onClick={apply} className="btn btn-primary flex-1">
          Apply
        </button>
        <button onClick={reset} className="pnx-pnx-btn pnx-pnx-pnx-btn-outline">
          Reset
        </button>
      </div>
    </div>
  );
}

/* ---------------- Data + Layout ---------------- */
function ListingsInner() {
  const searchParams = useSearchParams();

  const qRaw = searchParams?.get('q') ?? '';
  const q = sanitizeSearch(qRaw);
  const minP = parsePositiveInt(searchParams?.get('min') ?? '');
  const maxP = parsePositiveInt(searchParams?.get('max') ?? '');
  const beds = parsePositiveInt(searchParams?.get('beds') ?? '');
  const baths = parsePositiveInt(searchParams?.get('baths') ?? '');

  const sort = ((): SortKey => {
    const s = (searchParams?.get('sort') || '').toLowerCase();
    return (SORTABLE as readonly string[]).includes(s) ? (s as SortKey) : 'created_at';
  })();

  const dir: 'asc' | 'desc' = searchParams?.get('dir') === 'asc' ? 'asc' : 'desc';

  const [rows, setRows] = useState<RawProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = getSupabase();

      let query = supabase
        .from('properties')
        .select(
          'id,title,location,price,bedrooms,bathrooms,yield_percent,roi_percent,imageurl,latitude,longitude,created_at',
        )
        .limit(200);

      // order first to allow index use; fallback to created_at desc
      query = query.order(sort, { ascending: dir === 'asc', nullsFirst: false });
      if (sort !== 'created_at') {
        // secondary order for deterministic results
        query = query.order('created_at', { ascending: false });
      }

      // filters - only apply when defined
      if (q) query = query.or(`title.ilike.%${q}%,location.ilike.%${q}%`);
      if (minP !== undefined) query = query.gte('price', minP);
      if (maxP !== undefined) query = query.lte('price', maxP);
      if (beds !== undefined) query = query.gte('bedrooms', beds);
      if (baths !== undefined) query = query.gte('bathrooms', baths);

      const { data, error } = await query;
      if (cancelled) return;

      if (error) {
        console.error('[listings] supabase error', error);
        setRows([]);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [q, minP, maxP, beds, baths, sort, dir]);

  const points = useMemo(() => {
    return rows
      .filter((r) => r.latitude && r.longitude && r.id && r.title)
      .map((r) => ({
        id: String(r.id),
        title: String(r.title),
        lat: Number(r.latitude),
        lng: Number(r.longitude),
        price: r.price ?? undefined,
      }));
  }, [rows]);

  return (
    <Section>
      <SectionTitle>PropNexus Listings</SectionTitle>

      <div className="sticky-filter">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <FiltersBar />
        </div>
      </div>

      <div className="content-layout pt-4">
        {/* left: list */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-4">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-4">No results.</div>
          ) : (
            rows.map((r) => (
              <Link key={r.id ?? Math.random()} href={`/property/${r.id}`} className="block">
                <PropertyCard p={r as any} />
              </Link>
            ))
          )}
        </div>

        {/* right: sticky map */}
        <div className="map-sticky">
          <div className="leaflet-panel">
            <ClientMap points={points} defaultCenter={[53.5, -2]} />
          </div>
        </div>
      </div>
    </Section>
  );
}
