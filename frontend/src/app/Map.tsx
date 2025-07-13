"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { Property } from "@/app/types";
import "leaflet/dist/leaflet.css";

interface MapProps {
  properties: Property[];
}

export default function Map({ properties }: MapProps) {
  return (
    <MapContainer center={[51.505, -0.09]} zoom={6} style={{ height: "400px", width: "100%", marginTop: "2rem" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {properties.map((property) => (
        <Marker key={property.id} position={[property.latitude ?? 51.505, property.longitude ?? -0.09]}>
          <Popup>
            {property.title}<br />£{property.price.toLocaleString()}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
