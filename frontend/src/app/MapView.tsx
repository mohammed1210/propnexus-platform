'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Property } from '@/types';
import L from 'leaflet';

// ✅ Fix Leaflet marker icons (for Next.js)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type MapViewProps = {
  properties: Property[]; // Always pass an array, even if just one property
};

export default function MapView({ properties }: MapViewProps) {
  const defaultCenter: LatLngExpression = [52.5, -1.5];
  const [isVisible, setIsVisible] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsVisible(false); // hide map by default on mobile
    }
  }, []);

  const firstWithCoords = properties.find((p) => p.latitude && p.longitude);
  const mapCenter: LatLngExpression = firstWithCoords
    ? [firstWithCoords.latitude!, firstWithCoords.longitude!]
    : defaultCenter;

  const toggleMap = () => setIsVisible((prev) => !prev);

  if (!hasMounted) return null;

  return (
    <div className="map-view" style={{ position: 'relative' }}>
      {/* Mobile Toggle */}
      {typeof window !== 'undefined' && window.innerWidth < 768 && (
        <button onClick={toggleMap} className="map-toggle-button">
          {isVisible ? '🗺️ Hide Map' : '🗺️ Show Map'}
        </button>
      )}

      {isVisible && (
        <MapContainer
          center={mapCenter}
          zoom={6}
          scrollWheelZoom={false}
          style={{
            height: '100%',
            width: '100%',
            borderRadius: '10px',
            zIndex: 1,
          }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {properties
            .filter((p) => p.latitude && p.longitude)
            .map((property) => (
              <Marker
                key={property.id}
                position={[property.latitude!, property.longitude!] as LatLngExpression}
              >
                <Popup>
                  <strong>{property.title}</strong>
                  <br />
                  £{property.price.toLocaleString()}
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      )}
    </div>
  );
}