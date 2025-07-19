'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Property } from '../types';

// Custom teal icon
const tealIcon = new Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-turquoise.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type Props = {
  properties: Property[];
};

export default function MapView({ properties }: Props) {
  const center: LatLngExpression = [52.5, -1.5];

  useEffect(() => {
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
            icon={tealIcon}
          >
            <Popup>
              <strong>{property.title}</strong><br />
              £{property.price.toLocaleString()}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
