'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LeafletMap, LatLngBoundsExpression } from 'leaflet';
import nextDynamic from 'next/dynamic';

// Lazy-load react-leaflet only on the client
const MapContainer = nextDynamic(() => import('react-leaflet').then((m) => m.MapContainer), {
  ssr: false,
});
const TileLayer = nextDynamic(() => import('react-leaflet').then((m) => m.TileLayer), {
  ssr: false,
});
const Marker = nextDynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = nextDynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });

type Point = { id: string; title: string; lat: number; lng: number; price?: number; source?: string | null };

export default function ClientMap({
  points,
  defaultCenter,
}: {
  points: Point[];
  defaultCenter: [number, number];
}) {
  const mapRef = useRef<LeafletMap | null>(null);
  const [leafletLib, setLeafletLib] = useState<any>(null);

  useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = '/leaflet/leaflet.css';
      document.head.appendChild(link);
    }

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

  const sourceKey = (raw: unknown) => {
    const s = String(raw ?? '').toLowerCase().trim();
    if (!s) return 'other';
    if (s.includes('rightmove')) return 'rightmove';
    if (s.includes('zoopla')) return 'zoopla';
    if (s.includes('onthemarket')) return 'onthemarket';
    if (s === 'otm' || s.includes('otm')) return 'otm';
    if (s.includes('purplebricks')) return 'purplebricks';
    return 'other';
  };

  const fit = (m: LeafletMap, pts: { lat: number; lng: number }[]) => {
    if (!pts.length) return;
    const bounds: LatLngBoundsExpression = pts.map((p) => [p.lat, p.lng]) as any;
    m.fitBounds(bounds, { padding: [24, 24] });
  };

  // Called by MapContainer when it mounts
  const setMap = (instance: LeafletMap | null) => {
    if (!instance) return;
    mapRef.current = instance;
    if (points.length) fit(instance, points);
    else instance.setView(defaultCenter, 6);
  };

  // Re-fit when points change
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (points.length) fit(m, points);
    else m.setView(defaultCenter, 6);
  }, [points, defaultCenter]);

  return (
    <MapContainer
      key="map-root"
      ref={setMap as any}
      center={defaultCenter}
      zoom={6}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {points.map((p) => (
        <Marker
          key={p.id}
          position={{ lat: p.lat, lng: p.lng }}
          icon={
            markerIcons ? (markerIcons as any)[sourceKey(p.source)] ?? (markerIcons as any).other : undefined
          }
        >
          <Popup>
            <div className="text-sm font-medium">{p.title}</div>
            {typeof p.price === 'number' && (
              <div className="text-xs opacity-70">£{p.price.toLocaleString()}</div>
            )}
            <div className="mt-1">
              <a href={`/property/${p.id}`} className="underline text-xs">
                View details
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
