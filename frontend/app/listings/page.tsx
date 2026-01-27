'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import type { Map as LeafletMap, LatLngBoundsExpression } from 'leaflet';
import { FiSearch, FiSliders, FiMap, FiGrid, FiX } from 'react-icons/fi';

import PropertyCard from '@/components/PropertyCard';
import { isAuthEnabled } from '@/lib/auth';

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
 * Escapes %, comma, and other special chars that could interfere with ilike queries.
 * Limits length to 64 chars for safety.
 */
function sanitizeSearch(q: string): string {
  if (!q) return '';
  const sanitized = q.replace(/[%_,;'"\\]/g, ' ').replace(/\s+/g, ' ').trim();
  return sanitized.slice(0, 64);
}

// ✅ Safe auth hook (prevents Clerk from loading in CI/build when disabled)
type UseUserReturn = { user: any; isLoaded: boolean };

function useOptionalUser(): UseUserReturn {
  const authDisabled = !isAuthEnabled;
  const [state, setState] = useState<UseUserReturn>({ user: null, isLoaded: authDisabled });

  useEffect(() => {
    if (authDisabled) {
      setState({ user: null, isLoaded: true });
      return;
    }

    const clerk = (globalThis as any)?.Clerk as
      | undefined
      | {
          loaded?: boolean;
          user?: any;
          load?: () => Promise<void>;
        };

    if (!clerk) {
      setState({ user: null, isLoaded: true });
      return;
    }

    if (clerk.loaded) {
      setState({ user: clerk.user ?? null, isLoaded: true });
      return;
    }

    if (typeof clerk.load === 'function') {
      clerk
        .load()
        .then(() => setState({ user: clerk.user ?? null, isLoaded: true }))
        .catch(() => setState({ user: null, isLoaded: true }));
      return;
    }

    setState({ user: null, isLoaded: true });
  }, [authDisabled]);

  return state;
}

/**
 * Safe coordinate parsing.
 * - Accepts numbers or numeric strings
 * - Rejects null/undefined/NaN
 * - Rejects out-of-range coords
 * - Rejects 0,0 (common “missing” placeholder)
 */
function toValidLatLng(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const latNum = typeof lat === 'string' ? Number(lat) : (lat as number);
  const lngNum = typeof lng === 'string' ? Number(lng) : (lng as number);

  if (typeof latNum !== 'number' || typeof lngNum !== 'number') return null;
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;

  if (latNum < -90 || latNum > 90) return null;
  if (lngNum < -180 || lngNum > 180) return null;

  if (latNum === 0 && lngNum === 0) return null;

  return { lat: latNum, lng: lngNum };
}

const MapContainer = nextDynamic(() => import('react-leaflet').then((m) => m.MapContainer), {
  ssr: false,
});
const TileLayer = nextDynamic(() => import('react-leaflet').then((m) => m.TileLayer), {
  ssr: false,
});
const Marker = nextDynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = nextDynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });

/**
 * React-Leaflet v5: useMap is only available client-side.
 * Use require() to avoid SSR/import issues.
 */
const useMap = () => require('react-leaflet').useMap();

const SORTABLE = ['created_at', 'price', 'bedrooms', 'roi_percent', 'yield_percent'] as const;
type SortKey = (typeof SORTABLE)[number];

const INVESTMENT_TYPES = ['HMO', 'BTL', 'SA', 'BRR', 'Flip', 'Commercial'] as const;

type RawProperty = {
  id: string;
  title: string;
  location: string | null;
  price: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  description?: string | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
  source?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
  investment_type?: string | null;
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
  heatmapEnabled = false,
}: {
  points: { id: string; title: string; lat: number; lng: number; price?: number }[];
  defaultCenter: [number, number];
  heatmapEnabled?: boolean;
}) {
  const mapRef = useRef<LeafletMap | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // Fix default marker icons via CDN assets (prevents missing marker icons in many Next builds)
  useEffect(() => {
    (async () => {
      try {
        const leaflet = await import('leaflet');
        const L: any = leaflet.default ?? leaflet;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
      } catch {}
    })();
  }, []);

  const fit = (m: LeafletMap, pts: { lat: number; lng: number }[]) => {
    if (!pts.length) return;

    const safePts = pts.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (!safePts.length) return;

    const bounds: LatLngBoundsExpression = safePts.map((p) => [p.lat, p.lng]) as any;

    try {
      m.fitBounds(bounds, { padding: [24, 24] });
    } catch {
      m.setView(defaultCenter, 6);
    }
  };

  // Draw heatmap overlay (kept, but guarded)
  useEffect(() => {
    const canvas = canvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawHeatmap = () => {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;

      ctx.clearRect(0, 0, size.x, size.y);

      if (!heatmapEnabled || points.length === 0) return;

      points.forEach((point) => {
        const pixelPoint = map.latLngToContainerPoint([point.lat, point.lng]);

        const gradient = ctx.createRadialGradient(
          pixelPoint.x,
          pixelPoint.y,
          0,
          pixelPoint.x,
          pixelPoint.y,
          60
        );

        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.6)');
        gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size.x, size.y);
      });
    };

    drawHeatmap();
    map.on('moveend zoomend', drawHeatmap);

    return () => {
      map.off('moveend zoomend', drawHeatmap);
    };
  }, [heatmapEnabled, points, defaultCenter]);

  /**
   * ✅ React-Leaflet v5 fix:
   * Capture map instance using useMap() (NOT whenCreated)
   */
  function MapInit() {
    const map = useMap();

    // Capture map + invalidate size on mount
    useEffect(() => {
      if (!map) return;

      mapRef.current = map;

      requestAnimationFrame(() => {
        try {
          map.invalidateSize();
        } catch {}
        if (points.length) fit(map, points);
        else map.setView(defaultCenter, 6);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    // Refit when points change
    useEffect(() => {
      const m = mapRef.current;
      if (!m) return;

      requestAnimationFrame(() => {
        try {
          m.invalidateSize();
        } catch {}
        if (points.length) fit(m, points);
        else m.setView(defaultCenter, 6);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [points, defaultCenter]);

    return null;
  }

  const mapKey = `map-${points.length}-${defaultCenter[0]}-${defaultCenter[1]}`;

  if (process.env.NEXT_PUBLIC_DISABLE_LISTINGS_MAP === 'true') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400">
        Map disabled (NEXT_PUBLIC_DISABLE_LISTINGS_MAP=true)
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Optional heatmap overlay (canvas) – only matters if you enable it */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{ opacity: heatmapEnabled ? 1 : 0 }}
      />

      <MapContainer
        key={mapKey}
        center={defaultCenter}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <MapInit />

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
    </div>
  );
}

/* ---------------- Data + Layout ---------------- */
function ListingsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<'grid' | 'split' | 'map'>('split');
  const [showFilters, setShowFilters] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const qRaw = searchParams?.get('q') ?? '';
  const q = sanitizeSearch(qRaw);
  const minP = parsePositiveInt(searchParams?.get('min') ?? '');
  const maxP = parsePositiveInt(searchParams?.get('max') ?? '');
  const beds = parsePositiveInt(searchParams?.get('beds') ?? '');
  const baths = parsePositiveInt(searchParams?.get('baths') ?? '');
  const typesRaw = searchParams?.get('types') ?? '';
  const types = useMemo(() => (typesRaw ? typesRaw.split(',').filter(Boolean) : []), [typesRaw]);

  const sort = ((): SortKey => {
    const s = (searchParams?.get('sort') || '').toLowerCase();
    return (SORTABLE as readonly string[]).includes(s) ? (s as SortKey) : 'created_at';
  })();

  const dir: 'asc' | 'desc' = searchParams?.get('dir') === 'asc' ? 'asc' : 'desc';

  const [searchInput, setSearchInput] = useState(qRaw);
  const [minInput, setMinInput] = useState(searchParams?.get('min') ?? '');
  const [maxInput, setMaxInput] = useState(searchParams?.get('max') ?? '');
  const [bedsInput, setBedsInput] = useState(searchParams?.get('beds') ?? '');
  const [bathsInput, setBathsInput] = useState(searchParams?.get('baths') ?? '');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(types);

  const [rows, setRows] = useState<RawProperty[]>([]);
  const [loading, setLoading] = useState(true);

  const { user, isLoaded } = useOptionalUser();

  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);
  const [scrapeErr, setScrapeErr] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const userEmail = user?.primaryEmailAddress?.emailAddress || '';
  const isAdmin =
    adminEmails.length > 0
      ? adminEmails.includes(userEmail)
      : userEmail === 'abbas_m90@hotmail.com';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL ||
          process.env.NEXT_PUBLIC_API_BASE ||
          'http://localhost:8080';

        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (minP !== undefined) params.set('min', String(minP));
        if (maxP !== undefined) params.set('max', String(maxP));
        if (beds !== undefined) params.set('beds', String(beds));
        if (baths !== undefined) params.set('baths', String(baths));
        if (types.length > 0) params.set('types', types.join(','));
        params.set('sort', sort);
        params.set('dir', dir);
        params.set('limit', '200');

        const response = await fetch(`${backendUrl}/properties?${params.toString()}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });

        if (cancelled) return;

        if (!response.ok) {
          throw new Error(`Failed to fetch properties: ${response.status}`);
        }

        const data = await response.json();

        const mappedData: RawProperty[] = (data || []).map((prop: any) => ({
          id: String(prop.id ?? ''),
          title: String(prop.title ?? ''),
          location: prop.location,
          price: prop.price,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
          description: prop.description,
          yield_percent: prop.yield_percent,
          roi_percent: prop.roi_percent,
          imageurl: prop.imageurl,
          source: prop.source,
          latitude: prop.latitude,
          longitude: prop.longitude,
          created_at: prop.created_at,
          investment_type: prop.investment_type,
        }));

        setRows(mappedData);
      } catch (error) {
        console.error('[listings] fetch error', error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [q, minP, maxP, beds, baths, types, sort, dir, refreshNonce]);

  // ✅ robust points creation (no falsy checks, reject invalid/null-island)
  const points = useMemo(() => {
    return rows
      .map((r) => {
        if (!r.id || !r.title) return null;
        const coords = toValidLatLng(r.latitude, r.longitude);
        if (!coords) return null;

        return {
          id: String(r.id),
          title: String(r.title),
          lat: coords.lat,
          lng: coords.lng,
          price: r.price ?? undefined,
        };
      })
      .filter(Boolean) as { id: string; title: string; lat: number; lng: number; price?: number }[];
  }, [rows]);

  const applyFilters = () => {
    const p = new URLSearchParams();
    if (searchInput) p.set('q', searchInput);
    if (minInput) p.set('min', minInput);
    if (maxInput) p.set('max', maxInput);
    if (bedsInput) p.set('beds', bedsInput);
    if (bathsInput) p.set('baths', bathsInput);
    if (selectedTypes.length > 0) p.set('types', selectedTypes.join(','));
    if (sort) p.set('sort', sort);
    if (dir) p.set('dir', dir);
    router.push(`/listings?${p.toString()}`);
  };

  const runScrape = async () => {
    setScrapeErr(null);
    setScrapeMsg(null);

    const loc = sanitizeSearch(searchInput || qRaw || '');
    if (!loc) {
      setScrapeErr('Enter a location first (e.g. London, UB7, Manchester).');
      return;
    }

    setScrapeLoading(true);

    try {
      const res = await fetch('/api/admin/import-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: loc }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.detail || data?.error || `Scrape failed (${res.status})`);
      }

      const c = typeof data?.count === 'number' ? data.count : 0;
      setScrapeMsg(`Scrape complete: imported ${c} listings for “${loc}”. Refreshing…`);

      // refresh the listings fetch
      setRefreshNonce((n) => n + 1);
    } catch (e: any) {
      setScrapeErr(e?.message || 'Scrape failed');
    } finally {
      setScrapeLoading(false);
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setMinInput('');
    setMaxInput('');
    setBedsInput('');
    setBathsInput('');
    setSelectedTypes([]);
    router.push('/listings');
  };

  const removeFilter = (key: string, value?: string) => {
    const p = new URLSearchParams(searchParams?.toString());
    if (key === 'types' && value) {
      const currentTypes = p.get('types')?.split(',').filter(Boolean) || [];
      const newTypes = currentTypes.filter((t) => t !== value);
      if (newTypes.length > 0) p.set('types', newTypes.join(','));
      else p.delete('types');
    } else {
      p.delete(key);
    }
    router.push(`/listings?${p.toString()}`);
  };

  const activeFilters: Array<{ key: string; label: string; value: string }> = [];
  if (qRaw) activeFilters.push({ key: 'q', label: qRaw, value: qRaw });
  if (minP) activeFilters.push({
    key: 'min',
    label: `Min £${minP.toLocaleString()}`,
    value: String(minP),
  });
  if (maxP) activeFilters.push({
    key: 'max',
    label: `Max £${maxP.toLocaleString()}`,
    value: String(maxP),
  });
  if (beds) activeFilters.push({ key: 'beds', label: `${beds}+ beds`, value: String(beds) });
  if (baths) activeFilters.push({ key: 'baths', label: `${baths}+ baths`, value: String(baths) });
  types.forEach((type) => activeFilters.push({ key: 'types', label: type, value: type }));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Filter bar - sticky at very top when scrolling */}
      <div
        className={`bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40 transition-all duration-300 ${
          isScrolled ? 'shadow-md' : ''
        }`}
      >
        <div
          className="max-w-7xl mx-auto px-4 transition-all duration-300"
          style={{
            paddingTop: isScrolled ? '0.5rem' : '1rem',
            paddingBottom: isScrolled ? '0.5rem' : '1rem',
          }}
        >
          <div className={`flex items-center justify-between transition-all duration-300 ${isScrolled ? 'mb-2' : 'mb-4'}`}>
            <h1
              className={`font-bold text-slate-900 dark:text-white transition-all duration-300 ${
                isScrolled ? 'text-lg' : 'text-2xl'
              }`}
            >
              {!isScrolled && 'Property Listings'}
              {isScrolled && 'Listings'}
            </h1>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  viewMode === 'grid'
                    ? 'bg-brand-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <FiGrid className="inline mr-1" />
                {!isScrolled && 'Grid'}
              </button>

              <button
                onClick={() => setViewMode('split')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  viewMode === 'split'
                    ? 'bg-brand-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <FiGrid className="inline mr-1" />
                <FiMap className="inline" />
              </button>

              <button
                onClick={() => setViewMode('map')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  viewMode === 'map'
                    ? 'bg-brand-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <FiMap className="inline mr-1" />
                {!isScrolled && 'Map'}
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                  placeholder="Search by location, postcode, or property type..."
                  className="input-field w-full h-11 pl-12 pr-4"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={applyFilters}
                className="h-11 px-6 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-all duration-300 flex items-center gap-2"
                disabled={loading}
              >
                <FiSearch className="w-5 h-5" />
                Search
              </button>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="h-11 px-6 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 transition-all duration-300"
              >
                <FiSliders className="w-5 h-5" />
                Filters
                {activeFilters.length > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-brand-500 text-white text-xs font-medium">
                    {activeFilters.length}
                  </span>
                )}
              </button>

              {isLoaded && isAdmin && (
                <button
                  onClick={runScrape}
                  className="h-11 px-6 rounded-lg border border-brand-300 dark:border-brand-700 bg-white dark:bg-slate-800 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 font-semibold transition-all duration-300"
                  disabled={scrapeLoading}
                  title="Admin: run scrapers and import fresh listings"
                >
                  {scrapeLoading ? 'Running scrape…' : 'Run Scrape'}
                </button>
              )}
            </div>
          </div>

          {(scrapeMsg || scrapeErr) && (
            <div className="mt-3">
              {scrapeMsg && (
                <div className="px-4 py-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200">
                  {scrapeMsg}
                </div>
              )}
              {scrapeErr && (
                <div className="px-4 py-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-200">
                  {scrapeErr}
                </div>
              )}
            </div>
          )}

          {showFilters && (
            <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <input
                  type="text"
                  value={minInput}
                  onChange={(e) => setMinInput(e.target.value)}
                  placeholder="Min price"
                  className="input-field h-10"
                />
                <input
                  type="text"
                  value={maxInput}
                  onChange={(e) => setMaxInput(e.target.value)}
                  placeholder="Max price"
                  className="input-field h-10"
                />
                <input
                  type="text"
                  value={bedsInput}
                  onChange={(e) => setBedsInput(e.target.value)}
                  placeholder="Min beds"
                  className="input-field h-10"
                />
                <input
                  type="text"
                  value={bathsInput}
                  onChange={(e) => setBathsInput(e.target.value)}
                  placeholder="Min baths"
                  className="input-field h-10"
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                  Investment Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {INVESTMENT_TYPES.map((type) => {
                    const isSelected = selectedTypes.includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          if (isSelected) setSelectedTypes(selectedTypes.filter((t) => t !== type));
                          else setSelectedTypes([...selectedTypes, type]);
                        }}
                        className={`px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200 transform ${
                          isSelected
                            ? 'bg-brand-500 text-white border-brand-500 scale-105 shadow-md'
                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-brand-400 hover:scale-105'
                        }`}
                        aria-pressed={isSelected}
                        aria-label={`${type} investment type`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={applyFilters} className="btn-primary px-6 py-2">
                  Apply Filters
                </button>
                <button onClick={resetFilters} className="btn-secondary px-6 py-2">
                  Reset
                </button>
              </div>
            </div>
          )}

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {activeFilters.map((filter, idx) => (
                <span
                  key={`${filter.key}-${filter.value}-${idx}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-medium border border-brand-200 dark:border-brand-700"
                >
                  {filter.label}
                  <button
                    onClick={() => removeFilter(filter.key, filter.value)}
                    className="hover:text-brand-900 dark:hover:text-brand-100 transition-colors"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {(viewMode === 'grid' || viewMode === 'split') && (
          <div className="mb-6 flex items-center justify-between">
            <p className="text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-white">{rows.length}</span> properties found
            </p>
            <select
              value={sort}
              onChange={(e) => {
                const p = new URLSearchParams(searchParams?.toString());
                p.set('sort', e.target.value);
                router.push(`/listings?${p.toString()}`);
              }}
              className="input-field h-11 px-4 w-auto"
            >
              <option value="created_at">Most Recent</option>
              <option value="yield_percent">Highest Yield</option>
              <option value="price">Price: Low to High</option>
              <option value="bedrooms">Most Bedrooms</option>
            </select>
          </div>
        )}

        {viewMode === 'grid' && (
          <>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-600 dark:text-slate-400">Loading properties...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xl text-slate-600 dark:text-slate-400">No properties found</p>
                <button onClick={resetFilters} className="btn-primary mt-4">
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rows.map((property) => (
                    <PropertyCard key={property.id || Math.random()} p={property} />
                ))}
              </div>
            )}
          </>
        )}

        {viewMode === 'split' && (
          <div className="flex gap-6">
            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 text-slate-600 dark:text-slate-400">Loading properties...</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-xl text-slate-600 dark:text-slate-400">No properties found</p>
                  <button onClick={resetFilters} className="btn-primary mt-4">
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {rows.map((property) => (
                    <PropertyCard key={property.id || Math.random()} p={property} />
                  ))}
                </div>
              )}
            </div>

            <div className="hidden lg:block w-[45%] relative">
              <div className="sticky top-[180px]">
                <div
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                  style={{ height: 'calc(100vh - 220px)' }}
                >
                  <ClientMap points={points} defaultCenter={[53.5, -2]} heatmapEnabled={false} />
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'map' && (
          <div
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            style={{ height: 'calc(100vh - 300px)' }}
          >
            <ClientMap points={points} defaultCenter={[53.5, -2]} heatmapEnabled={false} />
          </div>
        )}
      </div>
    </div>
  );
}
