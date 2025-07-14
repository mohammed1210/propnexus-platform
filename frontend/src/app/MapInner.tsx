"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { Property } from "./types";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";

// Fix default marker icon issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
});

interface MapInnerProps {
  properties: Property[];
}

export default function MapInner({ properties }: MapInnerProps) {
  return (
    <MapContainer center={[51.505, -0.09]} zoom={6} style={{ height: "500px", width: "100%", marginTop: "20px", borderRadius: "8px" }}>
      <TileLayer
        attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {properties
        .filter(
          (property) =>
            typeof property.latitude === "number" &&
            typeof property.longitude === "number"
        )
        .map((property) => (
          <Marker
            key={property.id}
            position={[property.latitude!, property.longitude!]}
          >
            <Popup>
              <strong>{property.title}</strong>
              <br />
              {property.location}
              <br />
              £{property.price.toLocaleString()}
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}