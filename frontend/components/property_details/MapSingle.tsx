// /frontend/components/property_details/MapSingle.tsx
'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';

// ✅ Leaflet icon fix for Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

type MinimalProperty = {
  latitude: number;
  longitude: number;
  title: string;
};

type MapSingleProps = {
  property?: MinimalProperty;
  latitude?: number;
  longitude?: number;
  title?: string;
};

export default function MapSingle(props: MapSingleProps) {
  // ✅ Pull values from either property object or direct props
  const latitude = props.property?.latitude ?? props.latitude;
  const longitude = props.property?.longitude ?? props.longitude;
  const title = props.property?.title ?? props.title ?? 'Unknown Property';

  const hasCoords =
    typeof latitude === 'number' &&
    !Number.isNaN(latitude) &&
    typeof longitude === 'number' &&
    !Number.isNaN(longitude);

  const position: LatLngExpression = hasCoords ? [latitude!, longitude!] : [52.5, -1.5];

  // ✅ Prevent SSR rendering issues
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  if (!hasCoords) {
    return (
      <div className="w-full rounded-md border border-gray-200 p-3 text-sm text-gray-600">
        Map unavailable — no coordinates provided.
      </div>
    );
  }

  return (
    <div style={{ height: 320, width: '100%', borderRadius: 10, overflow: 'hidden' }}>
      <MapContainer
        center={position}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>{title}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}