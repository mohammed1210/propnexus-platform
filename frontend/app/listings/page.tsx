'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import type { Map as LeafletMap, LatLngBoundsExpression } from 'leaflet';
import { FiSearch, FiSliders, FiMap, FiX } from 'react-icons/fi';

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

/** Parse a string to a non-negative integer (>= 0). */
function parseNonNegativeInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  if (isNaN(num) || num < 0) return undefined;
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

const SORTABLE = ['created_at_desc', 'price_asc', 'price_desc', 'yield_desc', 'roi_desc'] as const;
type SortKey = (typeof SORTABLE)[number];

const INVESTMENT_TYPES = ['HMO', 'BTL', 'SA', 'BRR', 'Flip', 'Commercial'] as const;

const PRICE_RANGES = [
  { key: 'any', label: 'Any', min: undefined, max: undefined },
  { key: '0-150', label: '0–150k', min: 0, max: 150000 },
  { key: '150-300', label: '150–300k', min: 150000, max: 300000 },
  { key: '300-500', label: '300–500k', min: 300000, max: 500000 },
  { key: '500-750', label: '500–750k', min: 500000, max: 750000 },
  { key: '750+', label: '750k+', min: 750000, max: undefined },
] as const;

const COUNT_OPTIONS = [
  { key: '', label: 'Any' },
  { key: '1', label: '1+' },
  { key: '2', label: '2+' },
  { key: '3', label: '3+' },
  { key: '4', label: '4+' },
  { key: '5', label: '5+' },
] as const;

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

  const [showMap, setShowMap] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mappableCount, setMappableCount] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-dismiss filters dropdown on meaningful scroll.
  useEffect(() => {
    if (!showFilters) return;
    const onScroll = () => setShowFilters(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [showFilters]);

  const qRaw = searchParams?.get('q') ?? '';
  const q = sanitizeSearch(qRaw);
  const minP = parsePositiveInt(searchParams?.get('min') ?? '');
  const maxP = parsePositiveInt(searchParams?.get('max') ?? '');
  const beds = parsePositiveInt(searchParams?.get('beds') ?? '');
  const baths = parsePositiveInt(searchParams?.get('baths') ?? '');
  const typesRaw = searchParams?.get('types') ?? '';
  const types = useMemo(() => (typesRaw ? typesRaw.split(',').filter(Boolean) : []), [typesRaw]);

  const dir: 'asc' | 'desc' = searchParams?.get('dir') === 'asc' ? 'asc' : 'desc';

  const sort = ((): SortKey => {
    const s = (searchParams?.get('sort') || '').toLowerCase();
    if ((SORTABLE as readonly string[]).includes(s)) return s as SortKey;

    // Back-compat mapping from legacy sort+dir
    const legacy = (searchParams?.get('sort') || '').toLowerCase();
    if (legacy === 'created_at') return 'created_at_desc';
    if (legacy === 'price') return dir === 'asc' ? 'price_asc' : 'price_desc';
    if (legacy === 'yield_percent') return 'yield_desc';
    if (legacy === 'roi_percent') return 'roi_desc';

    return 'created_at_desc';
  })();

  const limit = ((): number => {
    const raw = searchParams?.get('limit') ?? '';
    const v = parsePositiveInt(raw);
    if (v === 25 || v === 50 || v === 100) return v;
    return 50;
  })();

  const offset = ((): number => {
    const raw = searchParams?.get('offset') ?? '';
    const v = parseNonNegativeInt(raw);
    return v ?? 0;
  })();

  const [searchInput, setSearchInput] = useState(qRaw);
  const [minInput, setMinInput] = useState(searchParams?.get('min') ?? '');
  const [maxInput, setMaxInput] = useState(searchParams?.get('max') ?? '');
  const [bedsInput, setBedsInput] = useState(searchParams?.get('beds') ?? '');
  const [bathsInput, setBathsInput] = useState(searchParams?.get('baths') ?? '');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(types);

  const [rows, setRows] = useState<RawProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

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
        params.set('limit', String(limit));
        params.set('offset', String(offset));

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

        const items = Array.isArray(data) ? data : (data?.items ?? []);
        const mappable = typeof data?.mappable_count === 'number' ? data.mappable_count : null;
        const totalCount =
          typeof data?.total === 'number'
            ? data.total
            : Array.isArray(items)
              ? items.length
              : 0;
        const more = typeof data?.has_more === 'boolean' ? data.has_more : false;

        const mappedData: RawProperty[] = (items || [])
          .filter((prop: any) => String(prop?.source ?? '').toLowerCase() !== 'spareroom')
          .map((prop: any) => ({
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
        setTotal(totalCount);
        setHasMore(more);
        setMappableCount(mappable);
      } catch (error) {
        console.error('[listings] fetch error', error);
        setRows([]);
        setTotal(0);
        setHasMore(false);
        setMappableCount(0);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [q, minP, maxP, beds, baths, types, sort, limit, offset, refreshNonce]);

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

  const mapAvailable = (mappableCount ?? points.length) > 0;

  const priceRangeKey = useMemo(() => {
    const minStr = (minInput ?? '').trim();
    const maxStr = (maxInput ?? '').trim();
    const minN = minStr ? Number(minStr) : undefined;
    const maxN = maxStr ? Number(maxStr) : undefined;
    const match = PRICE_RANGES.find((r) => r.min === minN && r.max === maxN);
    return match?.key ?? 'any';
  }, [minInput, maxInput]);

  // If backend says nothing is mappable, force map hidden.
  useEffect(() => {
    if (loading) return;
    if (!mapAvailable && showMap) {
      setShowMap(false);
    }
  }, [loading, mapAvailable, showMap]);

  const showSplit = showMap && mapAvailable;

  const applyFilters = () => {
    const p = new URLSearchParams();
    if (searchInput) p.set('q', searchInput);
    if (minInput) p.set('min', minInput);
    if (maxInput) p.set('max', maxInput);
    if (bedsInput) p.set('beds', bedsInput);
    if (bathsInput) p.set('baths', bathsInput);
    if (selectedTypes.length > 0) p.set('types', selectedTypes.join(','));
    if (sort) p.set('sort', sort);
    p.set('limit', String(limit));
    p.set('offset', '0');
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

      const c =
        typeof data?.total_imported === 'number'
          ? data.total_imported
          : typeof data?.count === 'number'
            ? data.count
            : 0;
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
    p.set('offset', '0');
    router.push(`/listings?${p.toString()}`);
  };

  const showingFrom = total > 0 ? offset + 1 : 0;
  const showingTo = total > 0 ? Math.min(offset + rows.length, total) : 0;

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
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h1 className="font-bold text-slate-900 dark:text-white text-lg">
                Listings
              </h1>

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <FiMap className="w-4 h-4" />
                  Map
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showMap && mapAvailable}
                    onClick={() => setShowMap((v) => !v)}
                    disabled={!mapAvailable}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showMap && mapAvailable ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'
                    } ${!mapAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}
                    title={mapAvailable ? 'Toggle map' : 'Map unavailable (no coordinates)'}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        showMap && mapAvailable ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>

                <select
                  value={sort}
                  onChange={(e) => {
                    const p = new URLSearchParams(searchParams?.toString());
                    p.set('sort', e.target.value);
                    p.delete('dir');
                    p.set('offset', '0');
                    router.push(`/listings?${p.toString()}`);
                  }}
                  className="input-field h-9 px-3 w-auto"
                  aria-label="Sort"
                >
                  <option value="created_at_desc">Most recent</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="yield_desc">Highest yield</option>
                  <option value="roi_desc">Highest ROI</option>
                </select>
              </div>
            </div>

            {/* Search + actions */}
            <div className="flex flex-col lg:flex-row gap-2">
              <div className="flex-1">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                    placeholder="Search by location or postcode…"
                    className="input-field w-full h-10 pl-10 pr-3"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={applyFilters}
                  className="h-10 px-4 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-all duration-200 flex items-center gap-2"
                  disabled={loading}
                >
                  <FiSearch className="w-4 h-4" />
                  Search
                </button>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="h-10 px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 transition-all duration-200"
                >
                  <FiSliders className="w-4 h-4" />
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
                    className="h-10 px-4 rounded-lg border border-brand-300 dark:border-brand-700 bg-white dark:bg-slate-800 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 font-semibold transition-all duration-200"
                    disabled={scrapeLoading}
                    title="Admin: run scrapers and import fresh listings"
                  >
                    {scrapeLoading ? 'Running…' : 'Run Scrape'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {!mapAvailable && !loading && rows.length > 0 && (
            <div className="mt-3 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm">
              Map hidden — no listings in this result have coordinates yet
            </div>
          )}

          {/* Filters panel */}

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
            <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 max-h-[60vh] overflow-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Price
                  </label>
                  <select
                    value={priceRangeKey}
                    onChange={(e) => {
                      const r = PRICE_RANGES.find((x) => x.key === e.target.value) ?? PRICE_RANGES[0];
                      setMinInput(typeof r.min === 'number' ? String(r.min) : '');
                      setMaxInput(typeof r.max === 'number' ? String(r.max) : '');
                    }}
                    className="input-field h-9 px-3 w-full"
                    aria-label="Price range"
                  >
                    {PRICE_RANGES.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Beds
                  </label>
                  <select
                    value={(bedsInput ?? '').trim()}
                    onChange={(e) => setBedsInput(e.target.value)}
                    className="input-field h-9 px-3 w-full"
                    aria-label="Bedrooms"
                  >
                    {COUNT_OPTIONS.map((o) => (
                      <option key={o.key || 'any'} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Baths
                  </label>
                  <select
                    value={(bathsInput ?? '').trim()}
                    onChange={(e) => setBathsInput(e.target.value)}
                    className="input-field h-9 px-3 w-full"
                    aria-label="Bathrooms"
                  >
                    {COUNT_OPTIONS.map((o) => (
                      <option key={o.key || 'any'} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Property type
                  </label>
                  <select
                    value=""
                    disabled
                    className="input-field h-9 px-3 w-full opacity-70 cursor-not-allowed"
                    aria-label="Property type (soon)"
                    title="Radius/type filters are not supported in backend yet"
                  >
                    <option value="">Any (soon)</option>
                  </select>
                </div>
              </div>

              <div className="mb-2">
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
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-white">
              {showingFrom}-{showingTo}
            </span>{' '}
            of <span className="font-semibold text-slate-900 dark:text-white">{total}</span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                const p = new URLSearchParams(searchParams?.toString());
                p.set('limit', e.target.value);
                p.set('offset', '0');
                router.push(`/listings?${p.toString()}`);
              }}
              className="input-field h-10 px-3 w-auto"
              aria-label="Page size"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>

            <button
              onClick={() => {
                const p = new URLSearchParams(searchParams?.toString());
                p.set('offset', String(Math.max(0, offset - limit)));
                router.push(`/listings?${p.toString()}`);
              }}
              disabled={loading || offset <= 0}
              className="h-10 px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => {
                const p = new URLSearchParams(searchParams?.toString());
                p.set('offset', String(offset + limit));
                router.push(`/listings?${p.toString()}`);
              }}
              disabled={loading || !hasMore}
              className="h-10 px-4 rounded-lg bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>

        {!showSplit && (
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

        {showSplit && (
          <div className="flex flex-col lg:flex-row gap-6">
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

            <div className="w-full lg:w-[38%] relative">
              <div className="lg:sticky lg:top-[180px]">
                <div
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden h-[360px] lg:h-[calc(100vh-220px)]"
                >
                  {points.length === 0 ? (
                    <div className="flex h-full w-full items-center justify-center text-sm text-slate-600 dark:text-slate-300">
                      Map hidden — no listings in this result have coordinates yet
                    </div>
                  ) : (
                    <ClientMap points={points} defaultCenter={[53.5, -2]} heatmapEnabled={false} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
