'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
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
  const center: LatLngExpression = [52.5, -1.5]; // Center of UK
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const isDesktop = window.innerWidth >= 768;
    setIsVisible(isDesktop);
  }, []);

  const toggleMap = () => {
    setIsVisible(!isVisible);
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* 🧭 Toggle button only on mobile */}
      <button
        onClick={toggleMap}
        className="map-toggle-button"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          padding: '8px 10px',
          fontSize: '14px',
          background: '#0ea5e9',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        {isVisible ? '🗺️ Hide Map' : '🗺️ Show Map'}
      </button>

      {isVisible && (
        <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }}>
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
                  <strong>{property.title}</strong>
                  <br />
                  £{property.price.toLocaleString()}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
}
