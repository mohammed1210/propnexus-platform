"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Property } from '../../src/types';
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";

interface MapProps {
  properties: Property[];
}

export default function MapClient({ properties }: MapProps) {
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    });
  }, []);

  return (
    <MapContainer
      center={[51.505, -0.09] as [number, number]}
      zoom={5}
      style={{ height: "500px", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {properties
        .filter((property) => property.latitude !== undefined && property.longitude !== undefined)
        .map((property) => (
          <Marker
            key={property.id}
            position={[property.latitude as number, property.longitude as number]}
          >
            <Popup>
              <strong>{property.title}</strong>
              <br />
              £{property.price.toLocaleString()}
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
