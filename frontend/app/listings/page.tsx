'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import type { Map as LeafletMap, LatLngBoundsExpression } from 'leaflet';
import { FiSearch, FiSliders, FiMapPin, FiMap, FiGrid, FiX } from 'react-icons/fi';
import { LuPoundSterling, LuBedDouble, LuBath } from 'react-icons/lu';

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
 * Escapes %, comma, and other special chars that could interfere with ilike queries.
 * Limits length to 64 chars for safety.
 */
function sanitizeSearch(q: string): string {
  if (!q) return '';
  // Replace potentially problematic characters with spaces
  // This is safe because Supabase uses parameterized queries internally
  // We're just cleaning the search term for the ilike pattern
  const sanitized = q
    .replace(/[%_,;'"\\]/g, ' ') // Remove SQL-like wildcards and special chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
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

const SORTABLE = ['created_at', 'price', 'bedrooms', 'roi_percent', 'yield_percent'] as const;
type SortKey = (typeof SORTABLE)[number];

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

  // Draw heatmap overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawHeatmap = () => {
      const bounds = map.getBounds();
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;

      // Clear canvas
      ctx.clearRect(0, 0, size.x, size.y);

      if (!heatmapEnabled || points.length === 0) return;

      // Draw radial gradients at each point
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
        
        // Dark mode palette - deep purple to transparent
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.6)');
        gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size.x, size.y);
      });
    };

    drawHeatmap();

    // Redraw on map move/zoom
    map.on('moveend zoomend', drawHeatmap);

    return () => {
      map.off('moveend zoomend', drawHeatmap);
    };
  }, [heatmapEnabled, points]);

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

/* ---------------- Data + Layout ---------------- */
function ListingsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // View mode state
  const [viewMode, setViewMode] = useState<'grid' | 'split' | 'map'>('split');
  const [showFilters, setShowFilters] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Scroll detection for header minimization
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Parse URL params
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

  // Filter state for quick search
  const [searchInput, setSearchInput] = useState(qRaw);
  const [minInput, setMinInput] = useState(searchParams?.get('min') ?? '');
  const [maxInput, setMaxInput] = useState(searchParams?.get('max') ?? '');
  const [bedsInput, setBedsInput] = useState(searchParams?.get('beds') ?? '');
  const [bathsInput, setBathsInput] = useState(searchParams?.get('baths') ?? '');

  const [rows, setRows] = useState<RawProperty[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = getSupabase();

      let query = supabase
        .from('properties')
        .select(
          'id,title,location,price,bedrooms,bathrooms,yield_percent,roi_percent,imageurl,latitude,longitude,created_at,investment_type:investmentType',
        )
        .limit(200);

      // Order
      query = query.order(sort, { ascending: dir === 'asc', nullsFirst: false });
      if (sort !== 'created_at') {
        query = query.order('created_at', { ascending: false });
      }

      // Filters
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

  const applyFilters = () => {
    const p = new URLSearchParams();
    if (searchInput) p.set('q', searchInput);
    if (minInput) p.set('min', minInput);
    if (maxInput) p.set('max', maxInput);
    if (bedsInput) p.set('beds', bedsInput);
    if (bathsInput) p.set('baths', bathsInput);
    if (sort) p.set('sort', sort);
    if (dir) p.set('dir', dir);
    router.push(`/listings?${p.toString()}`);
  };

  const resetFilters = () => {
    setSearchInput('');
    setMinInput('');
    setMaxInput('');
    setBedsInput('');
    setBathsInput('');
    router.push('/listings');
  };

  const removeFilter = (key: string) => {
    const p = new URLSearchParams(searchParams?.toString());
    p.delete(key);
    router.push(`/listings?${p.toString()}`);
  };

  // Active filters for pills
  const activeFilters: Array<{ key: string; label: string; value: string }> = [];
  if (qRaw) activeFilters.push({ key: 'q', label: qRaw, value: qRaw });
  if (minP) activeFilters.push({ key: 'min', label: `Min £${minP.toLocaleString()}`, value: String(minP) });
  if (maxP) activeFilters.push({ key: 'max', label: `Max £${maxP.toLocaleString()}`, value: String(maxP) });
  if (beds) activeFilters.push({ key: 'beds', label: `${beds}+ beds`, value: String(beds) });
  if (baths) activeFilters.push({ key: 'baths', label: `${baths}+ baths`, value: String(baths) });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header - becomes more compact when scrolled */}
      <div className={`bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-[68px] z-40 transition-all duration-300 ${isScrolled ? 'shadow-md' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 transition-all duration-300" style={{ paddingTop: isScrolled ? '0.75rem' : '1rem', paddingBottom: isScrolled ? '0.75rem' : '1rem' }}>
          <div className={`flex items-center justify-between transition-all duration-300 ${isScrolled ? 'mb-2' : 'mb-4'}`}>
            <h1 className={`font-bold text-slate-900 dark:text-white transition-all duration-300 ${isScrolled ? 'text-xl' : 'text-2xl'}`}>Property Listings</h1>
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
                Grid
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
                Map
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search Input */}
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

            {/* Filter Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="h-11 px-6 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 transition-all duration-300"
            >
              <FiSliders className="w-5 h-5" />
              Filters
            </button>
          </div>

          {/* Expanded Filters */}
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

          {/* Active Filters Pills */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {activeFilters.map((filter, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-medium border border-brand-200 dark:border-brand-700"
                >
                  {filter.label}
                  <button
                    onClick={() => removeFilter(filter.key)}
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Results Count and Sort - shown for grid and split views */}
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

        {/* Grid Only View */}
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
                  <Link key={property.id ?? Math.random()} href={`/property/${property.id}`}>
                    <PropertyCard p={property as any} />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* Split View - Grid on Left, Sticky Map on Right */}
        {viewMode === 'split' && (
          <div className="flex gap-6">
            {/* Left: Property Cards - Scrollable */}
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
                    <Link key={property.id ?? Math.random()} href={`/property/${property.id}`}>
                      <PropertyCard p={property as any} />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Sticky Map */}
            <div className="hidden lg:block w-[45%] relative">
              <div className="sticky top-[180px]">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
                  <ClientMap points={points} defaultCenter={[53.5, -2]} heatmapEnabled={false} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Map Only View */}
        {viewMode === 'map' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden" style={{ height: 'calc(100vh - 300px)' }}>
            <ClientMap points={points} defaultCenter={[53.5, -2]} heatmapEnabled={false} />
          </div>
        )}
      </div>
    </div>
  );
}
