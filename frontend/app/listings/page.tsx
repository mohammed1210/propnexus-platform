'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import type { Map as LeafletMap, LatLngBoundsExpression } from 'leaflet';
import { FiSearch, FiSliders, FiMap, FiX } from 'react-icons/fi';

import PropertyCard from '@/components/PropertyCard';
import { isAuthEnabled } from '@/lib/auth';
import { API_BASE } from '@/lib/api';

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

function parseBoolParam(value: string | null | undefined): boolean {
  if (!value) return false;
  const s = value.trim().toLowerCase();
  return s === '1' || s === 'true' || s === 't' || s === 'yes' || s === 'on';
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

const SORTABLE = [
  'recommended',
  'created_at_desc',
  'price_asc',
  'price_desc',
  'yield_desc',
  'roi_desc',
] as const;
type SortKey = (typeof SORTABLE)[number];

const INVESTMENT_TYPES = ['HMO', 'BTL', 'SA', 'BRR', 'Flip', 'Commercial'] as const;

const PROPERTY_TYPE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'flat', label: 'Flat' },
  { value: 'studio', label: 'Studio' },
  { value: 'maisonette', label: 'Maisonette' },
  { value: 'terraced', label: 'Terraced' },
  { value: 'semi-detached', label: 'Semi-detached' },
  { value: 'detached', label: 'Detached' },
  { value: 'bungalow', label: 'Bungalow' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'land', label: 'Land' },
  { value: 'other', label: 'Other' },
] as const;

function normalizePropertyTypeParam(value: string): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase();
  const map: Record<string, string> = {
    // New keys (already correct)
    flat: 'flat',
    studio: 'studio',
    maisonette: 'maisonette',
    terraced: 'terraced',
    'semi-detached': 'semi-detached',
    detached: 'detached',
    bungalow: 'bungalow',
    commercial: 'commercial',
    land: 'land',
    other: 'other',

    // Back-compat: canonical labels previously used as values
    'flat/apartment': 'flat',
    apartment: 'flat',
    terrace: 'terraced',
    'semi detached': 'semi-detached',
  };
  return map[key] ?? raw;
}

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
  ai_score?: number | null;
  score?: number | null;
  recommended_score?: number | null;
  deal_reasons?: string[];
  deal_signals?: string[];
  discount_estimate_pct?: number | null;
  imageurl?: string | null;
  source?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
  investment_type?: string | null;
  property_type?: string | null;
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
  hoveredId,
  onHoverChange,
}: {
  points: { id: string; title: string; lat: number; lng: number; price?: number; source?: string | null }[];
  defaultCenter: [number, number];
  heatmapEnabled?: boolean;
  hoveredId?: string | null;
  onHoverChange?: (id: string | null) => void;
}) {
  const mapRef = useRef<LeafletMap | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [leafletLib, setLeafletLib] = useState<any>(null);

  // Load Leaflet CSS dynamically
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      // Self-hosted Leaflet assets (avoids CSP/CDN/SRI issues)
      link.href = '/leaflet/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  // Fix default marker icons via CDN assets (prevents missing marker icons in many Next builds)
  useEffect(() => {
    (async () => {
      try {
        const leaflet = await import('leaflet');
        const L: any = leaflet.default ?? leaflet;
        setLeafletLib(L);
        try {
          delete L.Icon.Default.prototype._getIconUrl;
        } catch {}
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: '/leaflet/marker-icon-2x.png',
          iconUrl: '/leaflet/marker-icon.png',
          shadowUrl: '/leaflet/marker-shadow.png',
        });
      } catch {}
    })();
  }, []);

  const sourceKey = useCallback((raw: unknown) => {
    const s = String(raw ?? '').toLowerCase().trim();
    if (!s) return 'other';
    if (s.includes('rightmove')) return 'rightmove';
    if (s.includes('zoopla')) return 'zoopla';
    if (s.includes('onthemarket')) return 'onthemarket';
    if (s === 'otm' || s.includes('otm')) return 'otm';
    if (s.includes('purplebricks')) return 'purplebricks';
    return 'other';
  }, []);

  const markerIcons = useMemo(() => {
    const L: any = leafletLib;
    if (!L?.divIcon) return null;

    const mk = (key: string) =>
      L.divIcon({
        className: '',
        html: `<div class="pnx-map-pin pnx-map-pin--${key}"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -8],
      });

    return {
      zoopla: mk('zoopla'),
      rightmove: mk('rightmove'),
      onthemarket: mk('onthemarket'),
      otm: mk('otm'),
      purplebricks: mk('purplebricks'),
      other: mk('other'),
    } as const;
  }, [leafletLib]);

  const iconFor = useCallback(
    (src: unknown, active: boolean) => {
      const L: any = leafletLib;
      const key = sourceKey(src);
      if (!active || !L?.divIcon) {
        return markerIcons ? (markerIcons as any)[key] ?? (markerIcons as any).other : undefined;
      }
      return L.divIcon({
        className: '',
        html: `<div class="pnx-map-pin pnx-map-pin--${key} pnx-map-pin--active"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -8],
      });
    },
    [leafletLib, markerIcons, sourceKey],
  );

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

        {points.map((p) => {
          const icon = iconFor(p.source, hoveredId === p.id);
          return (
            <Marker
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              {...(icon ? { icon } : {})}
              zIndexOffset={hoveredId === p.id ? 1000 : 0}
              opacity={hoveredId && hoveredId !== p.id ? 0.6 : 1}
              eventHandlers={{
                mouseover: () => onHoverChange?.(p.id),
                mouseout: () => onHoverChange?.(null),
              }}
            >
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
          );
        })}
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
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [mappableCount, setMappableCount] = useState<number | null>(null);
  const [mapRows, setMapRows] = useState<RawProperty[] | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Keep map toggle state in URL so it persists across pagination/filter changes.
  useEffect(() => {
    const mapParam = searchParams?.get('map');
    if (mapParam === '0') setShowMap(false);
    if (mapParam === '1') setShowMap(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams?.get('map')]);

  useEffect(() => {
    let lastY = typeof window !== 'undefined' ? window.scrollY : 0;
    const jitter = 10;
    const collapseAfterY = 80;

    const onScroll = () => {
      const y = window.scrollY;
      setIsScrolled(y > 20);

      const dy = y - lastY;
      if (Math.abs(dy) < jitter) {
        lastY = y;
        return;
      }

      // Scroll down -> collapse to just the search bar.
      if (dy > 0 && y > collapseAfterY) {
        setControlsCollapsed(true);
        setShowFilters(false);
      }

      // Scroll up -> expand.
      if (dy < 0) {
        setControlsCollapsed(false);
      }

      lastY = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-dismiss filters dropdown on meaningful scroll.
  useEffect(() => {
    if (!showFilters) return;
    const onScroll = () => setShowFilters(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [showFilters]);

  // Close filters on Escape.
  useEffect(() => {
    if (!showFilters) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowFilters(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showFilters]);

  const qRaw = searchParams?.get('q') ?? '';
  const q = sanitizeSearch(qRaw);
  const minP = parsePositiveInt(searchParams?.get('min') ?? '');
  const maxP = parsePositiveInt(searchParams?.get('max') ?? '');
  const beds = parsePositiveInt(searchParams?.get('beds') ?? '');
  const baths = parsePositiveInt(searchParams?.get('baths') ?? '');
  const typesRaw = searchParams?.get('types') ?? '';
  const types = useMemo(() => (typesRaw ? typesRaw.split(',').filter(Boolean) : []), [typesRaw]);
  const investmentTypeUrlRaw = (searchParams?.get('investment_type') ?? '').trim();
  const investmentTypeUrl = investmentTypeUrlRaw || (types[0] ? String(types[0]).trim() : '');
  const propertyTypeUrl = normalizePropertyTypeParam((searchParams?.get('property_type') ?? '').trim());

  const dealsOnlyUrl = parseBoolParam(searchParams?.get('deals_only'));
  const auctionOnlyUrl = parseBoolParam(searchParams?.get('auction_only'));
  const reducedOnlyUrl = parseBoolParam(searchParams?.get('reduced_only'));
  const needsRefurbOnlyUrl = parseBoolParam(searchParams?.get('needs_refurb_only'));
  const chainFreeOnlyUrl = parseBoolParam(searchParams?.get('chain_free_only'));
  const tenantedOnlyUrl = parseBoolParam(searchParams?.get('tenanted_only'));
  const cashBuyersOnlyUrl = parseBoolParam(searchParams?.get('cash_buyers_only'));
  const shortLeaseOnlyUrl = parseBoolParam(searchParams?.get('short_lease_only'));

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

    return 'recommended';
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

  const urlMin = searchParams?.get('min') ?? '';
  const urlMax = searchParams?.get('max') ?? '';
  const urlBeds = searchParams?.get('beds') ?? '';
  const urlBaths = searchParams?.get('baths') ?? '';

  const [searchInput, setSearchInput] = useState(qRaw);
  const [minInput, setMinInput] = useState(urlMin);
  const [maxInput, setMaxInput] = useState(urlMax);
  const [bedsInput, setBedsInput] = useState(urlBeds);
  const [bathsInput, setBathsInput] = useState(urlBaths);
  const [selectedInvestmentType, setSelectedInvestmentType] = useState<string>(investmentTypeUrl);
  const [selectedPropertyType, setSelectedPropertyType] = useState<string>(propertyTypeUrl);
  const [dealsOnly, setDealsOnly] = useState(dealsOnlyUrl);
  const [auctionOnly, setAuctionOnly] = useState(auctionOnlyUrl);
  const [reducedOnly, setReducedOnly] = useState(reducedOnlyUrl);
  const [needsRefurbOnly, setNeedsRefurbOnly] = useState(needsRefurbOnlyUrl);
  const [chainFreeOnly, setChainFreeOnly] = useState(chainFreeOnlyUrl);
  const [tenantedOnly, setTenantedOnly] = useState(tenantedOnlyUrl);
  const [cashBuyersOnly, setCashBuyersOnly] = useState(cashBuyersOnlyUrl);
  const [shortLeaseOnly, setShortLeaseOnly] = useState(shortLeaseOnlyUrl);

  const lastUrlInputsRef = useRef({
    q: qRaw,
    min: urlMin,
    max: urlMax,
    beds: urlBeds,
    baths: urlBaths,
  });

  // Sync local inputs with URL state (back/forward, pagination), but do not overwrite
  // values the user has already edited and not applied yet.
  useEffect(() => {
    const next = {
      q: qRaw,
      min: urlMin,
      max: urlMax,
      beds: urlBeds,
      baths: urlBaths,
    };

    const prev = lastUrlInputsRef.current;

    if (searchInput === prev.q && next.q !== prev.q) setSearchInput(next.q);
    if (minInput === prev.min && next.min !== prev.min) setMinInput(next.min);
    if (maxInput === prev.max && next.max !== prev.max) setMaxInput(next.max);
    if (bedsInput === prev.beds && next.beds !== prev.beds) setBedsInput(next.beds);
    if (bathsInput === prev.baths && next.baths !== prev.baths) setBathsInput(next.baths);

    lastUrlInputsRef.current = next;
  }, [qRaw, urlMin, urlMax, urlBeds, urlBaths, searchInput, minInput, maxInput, bedsInput, bathsInput]);

  // Keep local selection in sync with URL state (back/forward navigation).
  useEffect(() => {
    setSelectedInvestmentType(investmentTypeUrl);
  }, [investmentTypeUrl]);

  useEffect(() => {
    setSelectedPropertyType(propertyTypeUrl);
  }, [propertyTypeUrl]);

  useEffect(() => {
    setDealsOnly(dealsOnlyUrl);
    setAuctionOnly(auctionOnlyUrl);
    setReducedOnly(reducedOnlyUrl);
    setNeedsRefurbOnly(needsRefurbOnlyUrl);
    setChainFreeOnly(chainFreeOnlyUrl);
    setTenantedOnly(tenantedOnlyUrl);
    setCashBuyersOnly(cashBuyersOnlyUrl);
    setShortLeaseOnly(shortLeaseOnlyUrl);
  }, [
    dealsOnlyUrl,
    auctionOnlyUrl,
    reducedOnlyUrl,
    needsRefurbOnlyUrl,
    chainFreeOnlyUrl,
    tenantedOnlyUrl,
    cashBuyersOnlyUrl,
    shortLeaseOnlyUrl,
  ]);

  const [rows, setRows] = useState<RawProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const { user, isLoaded } = useOptionalUser();

  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);
  const [scrapeErr, setScrapeErr] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const pushParams = useCallback(
    (updater: (p: URLSearchParams) => void, opts?: { replace?: boolean }) => {
      const p = new URLSearchParams(searchParams?.toString());
      updater(p);
      const qs = p.toString();
      const url = qs ? `/listings?${qs}` : '/listings';
      if (opts?.replace) router.replace(url);
      else router.push(url);
    },
    [router, searchParams]
  );

  // Ensure the default sort is explicit in the URL (so links/bookmarks are stable).
  useEffect(() => {
    const raw = (searchParams?.get('sort') ?? '').toLowerCase();
    const hasSort = !!raw;

    const isValid = (SORTABLE as readonly string[]).includes(raw);
    const isLegacy = raw === 'created_at' || raw === 'price' || raw === 'yield_percent' || raw === 'roi_percent';

    if (!hasSort || (!isValid && !isLegacy)) {
      pushParams(
        (p) => {
          p.set('sort', 'recommended');
        },
        { replace: true },
      );
    }
  }, [pushParams, searchParams]);

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
          (process.env.NEXT_PUBLIC_BACKEND_URL ||
            process.env.NEXT_PUBLIC_API_URL ||
            process.env.NEXT_PUBLIC_API_BASE ||
            API_BASE ||
            '').replace(/\/+$/, '') ||
          (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000');

        if (!backendUrl.trim()) {
          throw new Error('Missing backend base URL env (NEXT_PUBLIC_BACKEND_URL / NEXT_PUBLIC_API_URL).');
        }

        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (minP !== undefined) params.set('min', String(minP));
        if (maxP !== undefined) params.set('max', String(maxP));
        if (beds !== undefined) params.set('beds', String(beds));
        if (baths !== undefined) params.set('baths', String(baths));
        // Investment type filtering can be inconsistent in scraped datasets.
        // We keep the UI chips, but apply them client-side so they never feel “broken”.
        params.set('sort', sort);
        params.set('limit', String(limit));
        params.set('offset', String(offset));

        if (dealsOnlyUrl) params.set('deals_only', '1');
        if (auctionOnlyUrl) params.set('auction_only', '1');
        if (reducedOnlyUrl) params.set('reduced_only', '1');
        if (needsRefurbOnlyUrl) params.set('needs_refurb_only', '1');
        if (chainFreeOnlyUrl) params.set('chain_free_only', '1');
        if (tenantedOnlyUrl) params.set('tenanted_only', '1');
        if (cashBuyersOnlyUrl) params.set('cash_buyers_only', 'true');
        if (shortLeaseOnlyUrl) params.set('short_lease_only', 'true');
        if (investmentTypeUrl) params.set('investment_type', investmentTypeUrl);
        if (propertyTypeUrl) params.set('property_type', propertyTypeUrl);

        // When the map is enabled, request full-result points so pins reflect ALL
        // matching properties (not just the current paged list).
        if (showMap) {
          params.set('include_points', '1');
          params.set('points_limit', '5000');
        }

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
        const rawPoints = Array.isArray(data?.points) ? data.points : null;
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
            ...(prop && typeof prop === 'object' ? prop : {}),
            id: String(prop?.id ?? ''),
            title: String(prop?.title ?? ''),
            location: prop?.location,
            price: prop?.price,
            bedrooms: prop?.bedrooms,
            bathrooms: prop?.bathrooms,
            description: prop?.description,
            ai_score: prop?.ai_score,
            recommended_score: prop?.recommended_score,
            deal_reasons: Array.isArray(prop?.deal_reasons) ? prop.deal_reasons : undefined,
            deal_signals: Array.isArray(prop?.deal_signals) ? prop.deal_signals : undefined,
            discount_estimate_pct:
              typeof prop?.discount_estimate_pct === 'number' ? prop.discount_estimate_pct : null,
            imageurl: prop?.imageurl,
            source: prop?.source,
            latitude: prop?.latitude ?? prop?.lat,
            longitude: prop?.longitude ?? prop?.lng ?? prop?.lon,
            created_at: prop?.created_at,
            investment_type: prop?.investment_type,
            property_type: prop?.property_type,
          }));

        const mappedPoints: RawProperty[] | null = rawPoints
          ? (rawPoints || [])
              .filter((prop: any) => String(prop?.source ?? '').toLowerCase() !== 'spareroom')
              .map((prop: any) => ({
                ...(prop && typeof prop === 'object' ? prop : {}),
                id: String(prop?.id ?? ''),
                title: String(prop?.title ?? ''),
                location: prop?.location,
                price: prop?.price,
                bedrooms: prop?.bedrooms,
                bathrooms: prop?.bathrooms,
                description: prop?.description,
                ai_score: prop?.ai_score,
                recommended_score: prop?.recommended_score,
                deal_reasons: Array.isArray(prop?.deal_reasons) ? prop.deal_reasons : undefined,
                deal_signals: Array.isArray(prop?.deal_signals) ? prop.deal_signals : undefined,
                discount_estimate_pct:
                  typeof prop?.discount_estimate_pct === 'number' ? prop.discount_estimate_pct : null,
                imageurl: prop?.imageurl,
                source: prop?.source,
                latitude: prop?.latitude ?? prop?.lat,
                longitude: prop?.longitude ?? prop?.lng ?? prop?.lon,
                created_at: prop?.created_at,
                investment_type: prop?.investment_type,
                property_type: prop?.property_type,
              }))
          : null;

        setRows(mappedData);
        setMapRows(mappedPoints);
        setTotal(totalCount);
        setHasMore(more);
        setMappableCount(mappable);
      } catch (error) {
        console.error('[listings] fetch error', error);
        setRows([]);
        setMapRows(null);
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
  }, [
    q,
    minP,
    maxP,
    beds,
    baths,
    sort,
    limit,
    offset,
    refreshNonce,
    showMap,
    dealsOnlyUrl,
    auctionOnlyUrl,
    reducedOnlyUrl,
    needsRefurbOnlyUrl,
    chainFreeOnlyUrl,
    tenantedOnlyUrl,
    cashBuyersOnlyUrl,
    shortLeaseOnlyUrl,
    investmentTypeUrl,
    propertyTypeUrl,
  ]);

  const normInv = useCallback((v: unknown): string => {
    return String(v ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[-_]/g, '');
  }, []);

  const typeFilteredRows = useMemo(() => {
    if (!investmentTypeUrl) return rows;
    const selected = normInv(investmentTypeUrl);
    return rows.filter((p) => normInv(p.investment_type) === selected);
  }, [investmentTypeUrl, normInv, rows]);

  const typeFilteredMapRows = useMemo(() => {
    if (!mapRows) return typeFilteredRows;
    if (!investmentTypeUrl) return mapRows;
    const selected = normInv(investmentTypeUrl);
    return mapRows.filter((p) => normInv(p.investment_type) === selected);
  }, [investmentTypeUrl, mapRows, normInv, typeFilteredRows]);

  // ✅ robust points creation (no falsy checks, reject invalid/null-island)
  const points = useMemo(() => {
    return typeFilteredMapRows
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
          source: r.source ?? null,
        };
      })
      .filter(Boolean) as {
      id: string;
      title: string;
      lat: number;
      lng: number;
      price?: number;
      source?: string | null;
    }[];
  }, [typeFilteredMapRows]);

  const mapAvailable = points.length > 0;

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
    const p = new URLSearchParams(searchParams?.toString());
    // Set/clear in one place so paging/map/sort stay stable.
    if (searchInput) p.set('q', searchInput);
    else p.delete('q');
    if (minInput) p.set('min', minInput);
    else p.delete('min');
    if (maxInput) p.set('max', maxInput);
    else p.delete('max');
    if (bedsInput) p.set('beds', bedsInput);
    else p.delete('beds');
    if (bathsInput) p.set('baths', bathsInput);
    else p.delete('baths');
    // Investment type filter (single select)
    if (selectedInvestmentType) p.set('investment_type', selectedInvestmentType);
    else p.delete('investment_type');
    // Property type filter
    if (selectedPropertyType) p.set('property_type', selectedPropertyType);
    else p.delete('property_type');
    // Legacy param (kept for back-compat, but no longer written)
    p.delete('types');

    if (dealsOnly) p.set('deals_only', '1');
    else p.delete('deals_only');
    if (auctionOnly) p.set('auction_only', '1');
    else p.delete('auction_only');
    if (reducedOnly) p.set('reduced_only', '1');
    else p.delete('reduced_only');
    if (needsRefurbOnly) p.set('needs_refurb_only', '1');
    else p.delete('needs_refurb_only');
    if (chainFreeOnly) p.set('chain_free_only', '1');
    else p.delete('chain_free_only');
    if (tenantedOnly) p.set('tenanted_only', '1');
    else p.delete('tenanted_only');
    if (cashBuyersOnly) p.set('cash_buyers_only', 'true');
    else p.delete('cash_buyers_only');
    if (shortLeaseOnly) p.set('short_lease_only', 'true');
    else p.delete('short_lease_only');
    if (sort) p.set('sort', sort);
    p.set('limit', String(limit));
    p.set('offset', '0');
    p.set('map', showMap && mapAvailable ? '1' : '0');
    const qs = p.toString();
    router.push(qs ? `/listings?${qs}` : '/listings');
    setShowFilters(false);
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
    setSelectedInvestmentType('');
    setSelectedPropertyType('');
    setDealsOnly(false);
    setAuctionOnly(false);
    setReducedOnly(false);
    setNeedsRefurbOnly(false);
    setChainFreeOnly(false);
    setTenantedOnly(false);
    setCashBuyersOnly(false);
    setShortLeaseOnly(false);
    pushParams((p) => {
      p.delete('q');
      p.delete('min');
      p.delete('max');
      p.delete('beds');
      p.delete('baths');
      p.delete('investment_type');
      p.delete('types');
      p.delete('property_type');
      p.delete('deals_only');
      p.delete('auction_only');
      p.delete('reduced_only');
      p.delete('needs_refurb_only');
      p.delete('chain_free_only');
      p.delete('tenanted_only');
      p.delete('cash_buyers_only');
      p.delete('short_lease_only');
      p.set('offset', '0');
    });
    setShowFilters(false);
  };

  const removeFilter = (key: string, value?: string) => {
    pushParams((p) => {
      p.delete(key);
      p.set('offset', '0');
    });
  };

  const showingFrom = total > 0 ? offset + 1 : 0;
  const showingTo = total > 0 ? Math.min(offset + typeFilteredRows.length, total) : 0;

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
  if (investmentTypeUrl)
    activeFilters.push({ key: 'investment_type', label: investmentTypeUrl, value: investmentTypeUrl });
  if (propertyTypeUrl)
    activeFilters.push({ key: 'property_type', label: propertyTypeUrl, value: propertyTypeUrl });

  if (dealsOnlyUrl) activeFilters.push({ key: 'deals_only', label: 'Deals only', value: '1' });
  if (auctionOnlyUrl) activeFilters.push({ key: 'auction_only', label: 'Auction only', value: '1' });
  if (reducedOnlyUrl) activeFilters.push({ key: 'reduced_only', label: 'Reduced only', value: '1' });
  if (needsRefurbOnlyUrl)
    activeFilters.push({ key: 'needs_refurb_only', label: 'Needs work only', value: '1' });
  if (chainFreeOnlyUrl)
    activeFilters.push({ key: 'chain_free_only', label: 'Chain-free only', value: '1' });
  if (tenantedOnlyUrl)
    activeFilters.push({ key: 'tenanted_only', label: 'Tenanted only', value: '1' });
  if (cashBuyersOnlyUrl)
    activeFilters.push({ key: 'cash_buyers_only', label: 'Cash buyers only', value: 'true' });
  if (shortLeaseOnlyUrl)
    activeFilters.push({ key: 'short_lease_only', label: 'Short lease only', value: 'true' });

  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  const currentPage = total > 0 ? Math.min(totalPages, Math.floor(offset / limit) + 1) : 1;

  const pageItems = useMemo(() => {
    if (totalPages <= 1) return [] as Array<number | '…'>;
    const windowSize = 1;
    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    for (let p = currentPage - windowSize; p <= currentPage + windowSize; p++) {
      if (p >= 1 && p <= totalPages) pages.add(p);
    }
    const sorted = Array.from(pages).sort((a, b) => a - b);
    const out: Array<number | '…'> = [];
    for (let i = 0; i < sorted.length; i++) {
      const v = sorted[i];
      const prev = sorted[i - 1];
      if (i > 0 && prev !== undefined && v - prev > 1) out.push('…');
      out.push(v);
    }
    return out;
  }, [currentPage, totalPages]);

  const PaginationControls = ({ placement }: { placement: 'top' | 'bottom' }) => {
    if (total <= 0) return null;

    return (
      <div
        className={
          placement === 'top'
            ? 'mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'
            : 'mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center sm:text-center'
        }
      >
        <p className="text-slate-600 dark:text-slate-400 sm:order-2">
          <span className="font-semibold text-slate-900 dark:text-white">
            {showingFrom}-{showingTo}
          </span>{' '}
          of <span className="font-semibold text-slate-900 dark:text-white">{total}</span>
          {totalPages > 1 && (
            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
              Page {currentPage} of {totalPages}
            </span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2 sm:order-1 sm:justify-center">
          <select
            value={limit}
            onChange={(e) => {
              pushParams((p) => {
                p.set('limit', e.target.value);
                p.set('offset', '0');
              });
            }}
            className="input-field"
            style={{ height: 40, padding: '0.5rem 0.75rem' }}
            aria-label="Page size"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>

          <button
            onClick={() => {
              pushParams((p) => {
                p.set('offset', String(Math.max(0, offset - limit)));
              });
            }}
            disabled={loading || offset <= 0}
            className="h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {totalPages > 1 && (
            <div className="hidden sm:flex items-center gap-1">
              {pageItems.map((it, idx) =>
                it === '…' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-slate-500 dark:text-slate-400">
                    …
                  </span>
                ) : (
                  <button
                    key={`page-${it}`}
                    onClick={() => {
                      pushParams((p) => {
                        p.set('offset', String((it - 1) * limit));
                      });
                    }}
                    disabled={loading}
                    className={
                      it === currentPage
                        ? 'h-10 min-w-[40px] px-2 rounded-lg bg-brand-500 text-white font-semibold'
                        : 'h-10 min-w-[40px] px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600'
                    }
                    aria-current={it === currentPage ? 'page' : undefined}
                  >
                    {it}
                  </button>
                )
              )}
            </div>
          )}

          <button
            onClick={() => {
              pushParams((p) => {
                p.set('offset', String(offset + limit));
              });
            }}
            disabled={loading || !hasMore}
            className="h-10 px-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const FiltersPanelContent = (
    <div className="p-4" style={{ paddingTop: 14 }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Filters</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Compact filters (apply to search + paging)
          </div>
        </div>
        <button
          onClick={() => setShowFilters(false)}
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          aria-label="Close"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="col-span-2 md:col-span-2">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Price</label>
          <select
            value={priceRangeKey}
            onChange={(e) => {
              const r = PRICE_RANGES.find((x) => x.key === e.target.value) ?? PRICE_RANGES[0];
              setMinInput(typeof r.min === 'number' ? String(r.min) : '');
              setMaxInput(typeof r.max === 'number' ? String(r.max) : '');
            }}
            className="input-field w-full"
            style={{ height: 40, padding: '0.5rem 0.75rem' }}
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
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Beds</label>
          <select
            value={(bedsInput ?? '').trim()}
            onChange={(e) => setBedsInput(e.target.value)}
            className="input-field w-full"
            style={{ height: 40, padding: '0.5rem 0.75rem' }}
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
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Baths</label>
          <select
            value={(bathsInput ?? '').trim()}
            onChange={(e) => setBathsInput(e.target.value)}
            className="input-field w-full"
            style={{ height: 40, padding: '0.5rem 0.75rem' }}
            aria-label="Bathrooms"
          >
            {COUNT_OPTIONS.map((o) => (
              <option key={o.key || 'any'} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 md:col-span-4">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
            Property type
          </label>
          <select
            value={selectedPropertyType}
            onChange={(e) => setSelectedPropertyType(e.target.value)}
            className="input-field w-full"
            style={{ height: 40, padding: '0.5rem 0.75rem' }}
            aria-label="Property type"
          >
            {PROPERTY_TYPE_OPTIONS.map((t) => (
              <option key={t.value || 'any'} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Investment type</label>
        <div className="flex flex-wrap gap-2">
          {INVESTMENT_TYPES.map((type) => {
            const isSelected = selectedInvestmentType === type;
            return (
              <button
                key={type}
                onClick={() => {
                  if (isSelected) setSelectedInvestmentType('');
                  else setSelectedInvestmentType(type);
                }}
                className={`px-3 py-1.5 rounded-full border text-sm font-semibold transition-colors ${
                  isSelected
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-brand-400'
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

      <div className="mb-3">
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Deal signals</label>
        <div className="grid grid-cols-2 gap-2">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={dealsOnly}
              onChange={(e) => setDealsOnly(e.target.checked)}
            />
            Deals only
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={auctionOnly}
              onChange={(e) => setAuctionOnly(e.target.checked)}
            />
            Auction only
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={reducedOnly}
              onChange={(e) => setReducedOnly(e.target.checked)}
            />
            Reduced only
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={needsRefurbOnly}
              onChange={(e) => setNeedsRefurbOnly(e.target.checked)}
            />
            Needs work only
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={chainFreeOnly}
              onChange={(e) => setChainFreeOnly(e.target.checked)}
            />
            Chain-free only
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={tenantedOnly}
              onChange={(e) => setTenantedOnly(e.target.checked)}
            />
            Tenanted only
          </label>

          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={cashBuyersOnly}
              onChange={(e) => setCashBuyersOnly(e.target.checked)}
            />
            Cash buyers only
          </label>

          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={shortLeaseOnly}
              onChange={(e) => setShortLeaseOnly(e.target.checked)}
            />
            Short lease only
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={resetFilters}
          className="h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 font-semibold text-slate-700 dark:text-slate-200"
        >
          Reset
        </button>
        <button
          onClick={applyFilters}
          className="h-10 px-4 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold"
          disabled={loading}
        >
          Apply
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Compact sticky controls bar */}
      <div className={`sticky-filter ${isScrolled ? 'shadow-md' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            {/* Left: location search */}
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                  placeholder="Search location or postcode…"
                  className="input-field w-full"
                  style={{ height: 40, paddingLeft: 40, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}
                  aria-label="Search by location"
                />
              </div>
            </div>

            {/* Right: controls */}
            {!controlsCollapsed ? (
              <div className="flex items-center gap-2 justify-between md:justify-end">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                  <FiMap className="w-4 h-4" />
                  <span className="hidden sm:inline">Map</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showMap && mapAvailable}
                    onClick={() => {
                      const next = !(showMap && mapAvailable);
                      setShowMap(next);
                      pushParams(
                        (p) => {
                          p.set('map', next && mapAvailable ? '1' : '0');
                        },
                        { replace: true }
                      );
                    }}
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
                    pushParams((p) => {
                      p.set('sort', e.target.value);
                      p.delete('dir');
                      p.set('offset', '0');
                    });
                  }}
                  className="input-field"
                  style={{ height: 40, padding: '0.5rem 0.75rem' }}
                  aria-label="Sort"
                >
                  <option value="recommended">Top deals (Recommended)</option>
                  <option value="created_at_desc">Most recent</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="yield_desc">Highest yield</option>
                  <option value="roi_desc">Highest ROI</option>
                </select>

                <button
                  onClick={applyFilters}
                  className="h-10 px-3 md:px-4 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-all duration-200 flex items-center gap-2"
                  disabled={loading}
                >
                  <FiSearch className="w-4 h-4" />
                  <span className="hidden sm:inline">Search</span>
                </button>

                <button
                  onClick={() => setShowFilters((v) => !v)}
                  className="h-10 px-3 md:px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 transition-all duration-200"
                  aria-expanded={showFilters}
                  aria-controls="listings-filters-popover"
                >
                  <FiSliders className="w-4 h-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFilters.length > 0 && (
                    <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-brand-500 text-white text-xs font-medium">
                      {activeFilters.length}
                    </span>
                  )}
                </button>

                {isLoaded && isAdmin && (
                  <button
                    onClick={runScrape}
                    className="h-10 px-3 md:px-4 rounded-lg border border-brand-300 dark:border-brand-700 bg-white dark:bg-slate-800 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 font-semibold transition-all duration-200"
                    disabled={scrapeLoading}
                    title="Admin: run scrapers and import fresh listings"
                  >
                  {scrapeLoading ? 'Running…' : 'Run Scrape'}
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {!mapAvailable && !loading && rows.length > 0 && (
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              Map hidden — no listings in this result have coordinates yet
            </div>
          )}

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

        </div>
      </div>

      {/* Filters popover / drawer */}
      {showFilters && (
        <div
          id="listings-filters-popover"
          className="fixed inset-0 z-50"
          aria-modal="true"
          role="dialog"
        >
          <button
            className="absolute inset-0 bg-black/20 md:bg-transparent"
            aria-label="Close filters"
            onClick={() => setShowFilters(false)}
          />

          {/* Mobile drawer */}
          <div
            className="md:hidden absolute left-0 right-0 bottom-0 bg-white dark:bg-slate-800 rounded-t-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-[75vh] overflow-auto"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {FiltersPanelContent}
          </div>

          {/* Desktop popover (anchored under sticky bar) */}
          <div
            className="hidden md:block absolute right-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-[70vh] overflow-auto"
            style={{ top: 'calc(var(--header-h) + 56px + 8px)', width: 520 }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {FiltersPanelContent}
          </div>
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pt-2">
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter, idx) => (
              <span
                key={`${filter.key}-${filter.value}-${idx}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-medium border border-brand-200 dark:border-brand-700"
              >
                {filter.label}
                <button
                  onClick={() => removeFilter(filter.key, filter.value)}
                  className="hover:text-brand-900 dark:hover:text-brand-100 transition-colors"
                  aria-label={`Remove ${filter.label}`}
                >
                  <FiX className="w-4 h-4" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="mb-4 flex items-center justify-center sm:justify-start">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Total properties:{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              {typeof total === 'number' ? total.toLocaleString() : '—'}
            </span>
          </p>
        </div>

        {!showSplit && (
          <>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-600 dark:text-slate-400">Loading properties...</p>
              </div>
            ) : typeFilteredRows.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xl text-slate-600 dark:text-slate-400">No properties found</p>
                <button onClick={resetFilters} className="btn-primary mt-4">
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {typeFilteredRows.map((property) => (
                  <PropertyCard
                    key={property.id || Math.random()}
                    p={property}
                    showDealReasonChip={sort === 'recommended'}
                    isHovered={hoveredId === property.id}
                    onHoverChange={(h) => setHoveredId(h ? property.id : null)}
                  />
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
              ) : typeFilteredRows.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-xl text-slate-600 dark:text-slate-400">No properties found</p>
                  <button onClick={resetFilters} className="btn-primary mt-4">
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {typeFilteredRows.map((property) => (
                    <PropertyCard
                      key={property.id || Math.random()}
                      p={property}
                      showDealReasonChip={sort === 'recommended'}
                      isHovered={hoveredId === property.id}
                      onHoverChange={(h) => setHoveredId(h ? property.id : null)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="w-full lg:w-[38%] relative">
              <div className="lg:sticky lg:top-[calc(var(--header-h)+56px+16px)]">
                <div
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden h-[360px] lg:h-[calc(100vh-(var(--header-h)+56px+32px))]"
                >
                  {points.length === 0 ? (
                    <div className="flex h-full w-full items-center justify-center text-sm text-slate-600 dark:text-slate-300">
                      Map hidden — no listings in this result have coordinates yet
                    </div>
                  ) : (
                    <ClientMap
                      points={points}
                      defaultCenter={[53.5, -2]}
                      heatmapEnabled={false}
                      hoveredId={hoveredId}
                      onHoverChange={setHoveredId}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <PaginationControls placement="bottom" />
      </div>
    </div>
  );
}
