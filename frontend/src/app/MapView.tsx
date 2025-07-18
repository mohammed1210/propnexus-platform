'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Property } from '../types';

interface Props {
  properties: Property[];
}

export default function MapView({ properties }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current) {
      const map = L.map('leaflet-map').setView([51.505, -0.09], 6);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
      }).addTo(map);

      markerLayerRef.current = L.layerGroup().addTo(map);
    }

    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;

    if (map && markerLayer) {
      markerLayer.clearLayers();

      const coords: [number, number][] = [];

      properties.forEach((property) => {
        if (property.latitude && property.longitude) {
          const marker = L.marker([property.latitude, property.longitude]);
          marker.bindPopup(
            `<strong>${property.title}</strong><br/>£${property.price.toLocaleString()}`
          );
          marker.addTo(markerLayer);
          coords.push([property.latitude, property.longitude]);
        }
      });

      if (coords.length > 0) {
        map.fitBounds(coords, { padding: [30, 30] });
      }
    }
  }, [properties]);

  return (
    <div
      id="leaflet-map"
      className="map-view"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '500px',
        backgroundColor: '#f1f5f9',
      }}
    />
  );
}
