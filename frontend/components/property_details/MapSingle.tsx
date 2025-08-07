// /components/property-details/MapSingle.tsx
'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import { Property } from '@/types';

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

type MapSingleProps =
  | {
      /** Preferred: pass the whole property */
      property: Property;
      latitude?: never;
      longitude?: never;
      title?: never;
      height?: number | string;
    }
  | {
      /** Legacy: pass explicit coords/title */
      property?: never;
      latitude: number;
      longitude: number;
      title: string;
      height?: number | string;
    };

export default function MapSingle(props: MapSingleProps) {
  // Normalize inputs from either prop shape
  const latitude =
    'property' in props ? props.property.latitude : props.latitude;
  const longitude =
    'property' in props ? props.property.longitude : props.longitude;
  const title = 'property' in props ? props.property.title : props.title;
  const height = props.height ?? 300;

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  // Fallback center (UK-ish) if coords missing
  const hasCoords =
    typeof latitude === 'number' && typeof longitude === 'number';
  const position: LatLngExpression = hasCoords ? [latitude!, longitude!] : [52.5, -1.5];

  return (
    <div style={{ height, width: '100%', borderRadius: 10, overflow: 'hidden' }}>
      <MapContainer
        center={position}
        zoom={hasCoords ? 13 : 6}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {hasCoords && (
          <Marker position={position}>
            <Popup>{title ?? 'Selected property'}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
