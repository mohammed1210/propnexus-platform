"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Property } from "./types"; // ✅ using your shared type

type MapProps = {
  properties: Property[];
};

export default function Map({ properties }: MapProps) {
  return (
    <MapContainer center={[51.505, -0.09]} zoom={6} style={{ height: "500px", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {properties
        .filter((p) => p.latitude !== undefined && p.longitude !== undefined) // ✅ only valid coordinates
        .map((p) => (
          <Marker key={p.id} position={[p.latitude!, p.longitude!]}>
            <Popup>
              <strong>{p.title}</strong><br />
              {p.location} - £{p.price}
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
