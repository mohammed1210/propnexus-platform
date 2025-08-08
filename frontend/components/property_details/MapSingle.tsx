// /frontend/components/property_details/MapSingle.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

type MinimalProperty = {
  latitude?: number | null;
  longitude?: number | null;
  title?: string | null;
};

type MapSingleProps = {
  property?: MinimalProperty;
  latitude?: number;
  longitude?: number;
  title?: string;
};

export default function MapSingle(props: MapSingleProps) {
  // Pull from either shape
  const lat = props.property?.latitude ?? props.latitude;
  const lng = props.property?.longitude ?? props.longitude;
  const title = props.property?.title ?? props.title ?? 'Property';

  const hasCoords =
    typeof lat === 'number' && !Number.isNaN(lat) &&
    typeof lng === 'number' && !Number.isNaN(lng);

  const position: LatLngExpression = useMemo<LatLngExpression>(
    () => (hasCoords ? [lat as number, lng as number] : [52.5, -1.5]), // UK-ish fallback
    [hasCoords, lat, lng]
  );

  // Avoid SSR hiccups + set up icon paths after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);

    // Leaflet default icon fix for Next.js
    try {
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });
    } catch {
      /* no-op */
    }
  }, []);

  if (!mounted) return null;

  if (!hasCoords) {
    return (
      <div className="w-full rounded-md border border-gray-200 p-3 text-sm text-gray-600">
        Map unavailable — no coordinates provided.
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ height: 320, width: '100%' }}>
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
