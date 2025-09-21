'use client';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

const MapContainer = dynamic(
  async () => (await import('react-leaflet')).MapContainer,
  { ssr: false }
);
const TileLayer = dynamic(
  async () => (await import('react-leaflet')).TileLayer,
  { ssr: false }
);
const Marker = dynamic(
  async () => (await import('react-leaflet')).Marker,
  { ssr: false }
);

type Property = {
  id: string | null;
  title: string;
  latitude?: number | null;
  longitude?: number | null;
};

export default function MapList({ items }: { items: Property[] }) {
  const points = useMemo(
    () =>
      items
        .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .map(p => ({ id: p.id ?? '', title: p.title, lat: Number(p.latitude), lng: Number(p.longitude) })),
    [items]
  );

  if (!points.length) return null;

  const center = { lat: points[0].lat, lng: points[0].lng };

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200">
      <MapContainer
        style={{ height: 320, width: '100%' }}
        center={[center.lat, center.lng]}
        zoom={11}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map(p => (
          <Marker key={p.id} position={[p.lat, p.lng]} />
        ))}
      </MapContainer>
    </div>
  );
}
