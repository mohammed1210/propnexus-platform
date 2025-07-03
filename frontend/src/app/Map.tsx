"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Property } from "./types";
import L from "leaflet";

// Fix default marker icon (optional if default is missing)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

type MapProps = {
  properties: Property[];
};

export default function Map({ properties }: MapProps) {
  return (
    <MapContainer center={[54.5, -3]} zoom={6} style={{ height: "600px", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {properties
        .filter((p) => p.latitude && p.longitude)
        .map((p) => (
          <Marker key={p.id} position={[p.latitude, p.longitude]}>
            <Popup>
              <strong>{p.title}</strong><br />
              {p.address}<br />
              £{p.price.toLocaleString()}
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
