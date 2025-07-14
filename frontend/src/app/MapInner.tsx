"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { Property } from "./types";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface MapProps {
  properties: Property[];
}

export default function MapInner({ properties }: MapProps) {
  return (
    <MapContainer center={[53.5, -2]} zoom={6} style={{ height: "400px", width: "100%" }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {properties.map((prop) =>
        prop.latitude && prop.longitude ? (
          <Marker
            key={prop.id}
            position={[prop.latitude, prop.longitude]}
          >
            <Popup>
              <strong>{prop.title}</strong>
              <br />
              £{prop.price.toLocaleString()}
            </Popup>
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
}