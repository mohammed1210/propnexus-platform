"use client";

import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { Property } from "@/types/property";

// Fix default marker icon (Leaflet quirk in Next.js)
delete (L.Icon.Default as any).prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface Props {
  properties: Property[];
}

const Map = ({ properties }: Props) => {
  const center = { lat: 54.5, lng: -3 }; // Approximate UK center

  return (
    <MapContainer center={center} zoom={6} style={{ height: "500px", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {properties.map((property) => (
        <Marker
          key={property.id}
          position={[
            property.latitude ?? 0,
            property.longitude ?? 0,
          ]}
        >
          <Popup>
            <h3>{property.title}</h3>
            <p>{property.location}</p>
            <p>£{property.price.toLocaleString()}</p>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default Map;