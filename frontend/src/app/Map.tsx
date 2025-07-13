"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { Property } from "./types"; // ✅ Corrected import
import "leaflet/dist/leaflet.css";

interface MapProps {
  properties: Property[];
}

export default function MapView({ properties }: MapProps) {
  return (
    <div style={{ height: "600px", width: "100%", marginTop: "2rem" }}>
      <MapContainer center={[51.505, -0.09]} zoom={6} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {properties.map((property) => (
          <Marker
            key={property.id}
            position={[property.latitude ?? 51.505, property.longitude ?? -0.09]}
          >
            <Popup>
              <strong>{property.title}</strong><br />
              £{property.price.toLocaleString()}<br />
              {property.bedrooms} beds
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
