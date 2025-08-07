// /components/property-details/MapSingle.tsx

'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import { useEffect, useState } from 'react';

// ✅ Fix for Leaflet icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type MapSingleProps = {
  latitude: number;
  longitude: number;
  title: string;
};

export default function MapSingle({ latitude, longitude, title }: MapSingleProps) {
  const position: LatLngExpression = [latitude, longitude];
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  return (
    <div style={{ height: '300px', width: '100%', borderRadius: '10px' }}>
      <MapContainer center={position} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>{title}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
