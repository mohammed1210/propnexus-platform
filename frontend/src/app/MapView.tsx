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
    const map = L.map('leaflet-map').setView([51.505, -0.09], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
    }).addTo(map);

    properties.forEach((property) => {
      if (property.latitude && property.longitude) {
        const marker = L.marker([property.latitude, property.longitude]).addTo(map);
        marker.bindPopup(
          `<strong>${property.title}</strong><br/>£${property.price.toLocaleString()}`
        );
      }
    });

    // Fit bounds if properties have coords
    const coords = properties
      .filter((p) => p.latitude && p.longitude)
      .map((p) => [p.latitude, p.longitude]) as [number, number][];

    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [30, 30] });
    }

    return () => {
      map.remove(); // Clean up on unmount
    };
  }, [properties]);

  return (
    <div
      id="leaflet-map"
      style={{
        flex: '1 1 40%',
        height: '100%',
        minHeight: '500px',
        marginLeft: '20px',
        borderRadius: '10px',
        backgroundColor: '#f1f5f9',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        transition: 'all 0.2s ease',
      }}
    />
  );
}