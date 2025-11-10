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
import ListingsFilters from '@/components/listings/ListingsFilters';
import PageWrapper from '@/components/PageWrapper';

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

/* ---------------- Filters (with Sort) ---------------- */
// FIX: duplicate SORTABLE removed
// const SORTABLE = ['created_at', 'price', 'bedrooms', 'roi_percent', 'yield_percent'] as const;
// FIX: duplicate SortKey removed
// type SortKey = (typeof SORTABLE)[number];

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
    <div className="grid grid-cols-2 md:grid-cols-10 gap-2" role="search" aria-label="Property filters">
      <div className="col-span-2 md:col-span-2 flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
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

      <div className="col-span-2 flex gap-2">
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
  // Default toggle for heatmap (feature flag controlled)
  const heatmapEnabled = process.env.NEXT_PUBLIC_FEATURE_HEATMAP === "true";
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
      
      // Mock data for development/demo purposes
      const mockProperties: RawProperty[] = [
        {
          id: '1',
          title: '3-Bed Victorian Terrace - High ROI Potential',
          location: 'Manchester, Greater Manchester',
          price: 185000,
          bedrooms: 3,
          bathrooms: 1,
          yield_percent: 6.5,
          roi_percent: 14.2,
          imageurl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop',
          latitude: 53.4808,
          longitude: -2.2426,
          created_at: new Date().toISOString(),
          investment_type: 'BTL',
        },
        {
          id: '2',
          title: 'Modern 2-Bed Apartment - City Centre',
          location: 'Birmingham, West Midlands',
          price: 165000,
          bedrooms: 2,
          bathrooms: 2,
          yield_percent: 5.8,
          roi_percent: 11.5,
          imageurl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
          latitude: 52.4862,
          longitude: -1.8904,
          created_at: new Date().toISOString(),
          investment_type: 'BTL',
        },
        {
          id: '3',
          title: '5-Bed HMO - Excellent Student Area',
          location: 'Leeds, West Yorkshire',
          price: 225000,
          bedrooms: 5,
          bathrooms: 2,
          yield_percent: 8.2,
          roi_percent: 16.8,
          imageurl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&h=600&fit=crop',
          latitude: 53.8008,
          longitude: -1.5491,
          created_at: new Date().toISOString(),
          investment_type: 'HMO',
        },
        {
          id: '4',
          title: '4-Bed Semi-Detached - Family Favorite',
          location: 'Liverpool, Merseyside',
          price: 195000,
          bedrooms: 4,
          bathrooms: 2,
          yield_percent: 5.2,
          roi_percent: 10.8,
          imageurl: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800&h=600&fit=crop',
          latitude: 53.4084,
          longitude: -2.9916,
          created_at: new Date().toISOString(),
          investment_type: 'BTL',
        },
        {
          id: '5',
          title: 'Serviced Apartment - Prime Location',
          location: 'Newcastle upon Tyne, Tyne and Wear',
          price: 145000,
          bedrooms: 1,
          bathrooms: 1,
          yield_percent: 7.5,
          roi_percent: 13.9,
          imageurl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
          latitude: 54.9783,
          longitude: -1.6178,
          created_at: new Date().toISOString(),
          investment_type: 'SA',
        },
        {
          id: '6',
          title: 'Commercial Property - Mixed Use',
          location: 'Sheffield, South Yorkshire',
          price: 285000,
          bedrooms: 0,
          bathrooms: 2,
          yield_percent: 6.8,
          roi_percent: 12.4,
          imageurl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop',
          latitude: 53.3811,
          longitude: -1.4701,
          created_at: new Date().toISOString(),
          investment_type: 'Commercial',
        },
      ];

      try {
        const supabase = getSupabase();
        
        // Parse selectedTypes from searchParams only
        const selectedTypesParam = searchParams?.get("selectedTypes") ?? "";
        const selectedTypes = selectedTypesParam ? selectedTypesParam.split(",").filter(Boolean) : [];

        let query = supabase
          .from('properties')
          .select(
            'id,title,location,price,bedrooms,bathrooms,yield_percent,roi_percent,imageurl,latitude,longitude,created_at,investment_type:investmentType',
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
          console.warn('[listings] Using mock data - Supabase connection unavailable');
          // Use mock data when Supabase is unavailable
          let filtered = [...mockProperties];
          
          // Apply client-side filters to mock data
          if (q) {
            const search = q.toLowerCase();
            filtered = filtered.filter(p => 
              p.title?.toLowerCase().includes(search) || 
              p.location?.toLowerCase().includes(search)
            );
          }
          if (minP !== undefined) filtered = filtered.filter(p => (p.price ?? 0) >= minP);
          if (maxP !== undefined) filtered = filtered.filter(p => (p.price ?? 0) <= maxP);
          if (beds !== undefined) filtered = filtered.filter(p => (p.bedrooms ?? 0) >= beds);
          if (baths !== undefined) filtered = filtered.filter(p => (p.bathrooms ?? 0) >= baths);
          
          setRows(filtered);
        } else {
          setRows(data || []);
        }
      } catch (err) {
        console.warn('[listings] Using mock data - Error connecting to database');
        // Use mock data on any error
        setRows(mockProperties);
      }
      
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [q, minP, maxP, beds, baths, sort, dir, searchParams]);

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
    <PageWrapper showOrbs={true}>
      <Section>
        <SectionTitle>PropNexus Listings</SectionTitle>

        <ListingsFilters />

        {/* Result Summary */}
        <div className="mt-4 mb-3 px-4 md:px-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl border" style={{
            background: 'var(--card-bg)',
            borderColor: 'var(--border-secondary)',
          }}>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {loading ? '...' : `${rows.length} ${rows.length === 1 ? 'property' : 'properties'}`}
              </span>
              {!loading && rows.length > 0 && (
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>found</span>
              )}
            </div>
            
            {/* Active Filters Display */}
            <div className="flex flex-wrap gap-2 items-center">
              {q && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300">
                  Search: {q}
                </span>
              )}
              {minP !== undefined && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  Min: £{minP.toLocaleString()}
                </span>
              )}
              {maxP !== undefined && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  Max: £{maxP.toLocaleString()}
                </span>
              )}
              {beds !== undefined && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                  {beds}+ beds
                </span>
              )}
              {baths !== undefined && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                  {baths}+ baths
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="content-layout pt-4">
          {/* left: list */}
          <div className="space-y-3">
            {loading ? (
              <>
                {/* Skeleton loaders */}
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="card p-0 overflow-hidden animate-pulse">
                    <div className="w-full bg-gray-200 dark:bg-gray-700" style={{ aspectRatio: '16 / 9' }} />
                    <div className="p-5 space-y-3">
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-zinc-700">
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                        <div className="flex gap-3">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : rows.length === 0 ? (
              <div className="p-6 card text-center">
                <p className="text-lg font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>No properties found</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Try adjusting your filters to see more results</p>
              </div>
            ) : (
              rows.map((r) => (
                <PropertyCard key={r.id ?? Math.random()} p={r as any} />
              ))
            )}
          </div>

          {/* right: sticky map */}
          <div className="map-sticky">
            <div className="leaflet-panel card">
              <ClientMap points={points} defaultCenter={[53.5, -2]} heatmapEnabled={heatmapEnabled} />
            </div>
          </div>
        </div>
      </Section>
    </PageWrapper>
  );
}
