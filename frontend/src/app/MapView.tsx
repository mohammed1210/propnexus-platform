'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Property } from '../types';

// ✅ Fix missing default icon bug in Next.js + Leaflet
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type Props = {
  properties: Property[];
};

export default function MapView({ properties }: Props) {
  const center: LatLngExpression = [52.5, -1.5]; // UK default center

  useEffect(() => {
    // Ensure Leaflet styles are present for map rendering
    const leafletStyles = document.getElementById('leaflet-css');
    if (!leafletStyles) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet/dist/leaflet.css';
      link.id = 'leaflet-css';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <MapContainer
        center={center}
        zoom={6}
        style={{
          height: '100%',
          width: '100%',
          borderRadius: '10px',
        }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {properties.map((property) => {
          if (!property.latitude || !property.longitude) return null;

          return (
            <Marker
              key={property.id}
              position={[property.latitude, property.longitude]}
            >
              <Popup>
                <strong>{property.title}</strong><br />
                £{property.price.toLocaleString()}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
