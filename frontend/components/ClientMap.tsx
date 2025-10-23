'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, LatLngBoundsExpression } from 'leaflet';
import nextDynamic from 'next/dynamic';

// Lazy-load react-leaflet only on the client
const MapContainer = nextDynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer     = nextDynamic(() => import('react-leaflet').then(m => m.TileLayer),     { ssr: false });
const Marker        = nextDynamic(() => import('react-leaflet').then(m => m.Marker),        { ssr: false });
const Popup         = nextDynamic(() => import('react-leaflet').then(m => m.Popup),         { ssr: false });

type Point = { id: string; title: string; lat: number; lng: number; price?: number };

export default function ClientMap({
  points,
  defaultCenter,
}: {
  points: Point[];
  defaultCenter: [number, number];
}) {
  const mapRef = useRef<LeafletMap | null>(null);

  const fit = (m: LeafletMap, pts: { lat: number; lng: number }[]) => {
    if (!pts.length) return;
    const bounds: LatLngBoundsExpression = pts.map(p => [p.lat, p.lng]) as any;
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
      {points.map(p => (
        <Marker key={p.id} position={{ lat: p.lat, lng: p.lng }}>
          <Popup>
            <div className="text-sm font-medium">{p.title}</div>
            {typeof p.price === 'number' && (
              <div className="text-xs opacity-70">£{p.price.toLocaleString()}</div>
            )}
            <div className="mt-1">
              <a href={`/property/${p.id}`} className="underline text-xs">View details</a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
