"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import type { LatLngExpression } from "leaflet";

type Property = {
  id: string;
  title: string;
  location: string;
  price: number;
  description: string;
  latitude: number;
  longitude: number;
};

type Props = {
  properties: Property[];
};

export default function Map({ properties }: Props) {
  // Fix default icon
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
    });
  }, []);

  const customIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  const center: LatLngExpression = [53.8, -1.55];

  return (
    <MapContainer center={center} zoom={6} style={{ height: "80vh", width: "100%" }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {properties.map((prop) => (
        <Marker
          key={prop.id}
          position={[prop.latitude || 53.8, prop.longitude || -1.55]}
          icon={customIcon}
        >
          <Popup>
            <strong>{prop.title}</strong><br />
            £{prop.price.toLocaleString()}<br />
            {prop.location}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
