'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import type { Map as LeafletMap, LatLngBoundsExpression } from 'leaflet';

import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import PropertyCard from '@/components/PropertyCard';
import { getSupabase } from '@/lib/supabaseClient';
import ListingsFilters from '@/components/listings/ListingsFilters';

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
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
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
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 400,
        }}
        aria-hidden="true"
      />
    </div>
  );
}

/* ---------------- Data + Layout ---------------- */
function ListingsInner() {
  const searchParams = useSearchParams();

  const q = searchParams?.get('q') ?? '';
  const minP = Number(searchParams?.get('min') ?? '') || 0;
  const maxP = Number(searchParams?.get('max') ?? '') || 0;
  const beds = Number(searchParams?.get('beds') ?? '') || 0;
  const heatmapEnabled = searchParams?.get('heatmap') === '1';
  const selectedTypesStr = searchParams?.get('types') ?? '';

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
      const selectedTypes = selectedTypesStr.split(',').filter(Boolean);

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

      // filters
      if (q) query = query.or(`title.ilike.%${q}%,location.ilike.%${q}%`);
      if (minP) query = query.gte('price', minP);
      if (maxP) query = query.lte('price', maxP);
      if (beds) query = query.gte('bedrooms', beds);
      if (selectedTypes.length > 0) {
        query = query.in('investment_type', selectedTypes);
      }

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
  }, [q, minP, maxP, beds, sort, dir, selectedTypesStr]);

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

      <ListingsFilters />

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
            <ClientMap points={points} defaultCenter={[53.5, -2]} heatmapEnabled={heatmapEnabled} />
          </div>
        </div>
      </div>
    </Section>
  );
}
