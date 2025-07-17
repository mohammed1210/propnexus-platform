'use client';

import React, { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Property } from '../types';

interface Props {
  properties: Property[];
}

export default function MapView({ properties }: Props) {
  useEffect(() => {
    const map = L.map('map-container').setView([51.505, -0.09], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const markers: L.Marker[] = [];

    properties.forEach((property) => {
      if (property.latitude && property.longitude) {
        const marker = L.marker([property.latitude, property.longitude])
          .addTo(map)
          .bindPopup(
            `<strong>${property.title}</strong><br/>£${property.price.toLocaleString()}`
          );
        markers.push(marker);
      }
    });

    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.2));
    }

    return () => {
      map.remove();
    };
  }, [properties]);

  return (
    <div
      id="map-container"
      style={{
        flex: '1 1 40%',
        height: '100%',
        minHeight: '500px',
        marginLeft: '20px',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        transition: 'all 0.2s ease',
        zIndex: 0,
      }}
    />
  );
}