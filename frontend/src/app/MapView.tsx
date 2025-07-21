'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Property } from '../types';

// 🔧 Fix Leaflet icon paths for Next.js
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
  const defaultCenter: LatLngExpression = [52.5, -1.5]; // Fallback
  const [isVisible, setIsVisible] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);

  // 📱 Hide map by default on mobile
  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsVisible(false);
    }
  }, []);

  // 🗺 Center on first valid property with coords
  const mapCenter = properties.find(
    (p) => p.latitude && p.longitude
  )
    ? ([properties.find(p => p.latitude && p.longitude)!.latitude!,
        properties.find(p => p.latitude && p.longitude)!.longitude!] as LatLngExpression)
    : defaultCenter;

  const toggleMap = () => setIsVisible((prev) => !prev);

  if (!hasMounted) return null; // 🧼 Avoid SSR mismatch

  return (
    <div className="map-view" style={{ position: 'relative' }}>
      {/* 🧭 Mobile toggle only */}
      {typeof window !== 'undefined' && window.innerWidth < 768 && (
        <button
          onClick={toggleMap}
          className="map-toggle-button"
        >
          {isVisible ? '🗺️ Hide Map' : '🗺️ Show Map'}
        </button>
      )}

      {isVisible && (
        <MapContainer
          center={mapCenter}
          zoom={6}
          style={{
            height: '100%',
            width: '100%',
            borderRadius: '10px',
            zIndex: 1,
          }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {properties.map((property) =>
            property.latitude && property.longitude ? (
              <Marker
                key={property.id}
                position={[property.latitude, property.longitude]}
              >
                <Popup>
                  <strong>{property.title}</strong>
                  <br />
                  £{property.price.toLocaleString()}
                </Popup>
              </Marker>
            ) : null
          )}
        </MapContainer>
      )}
    </div>
  );
}
