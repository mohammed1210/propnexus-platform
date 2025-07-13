"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { Property } from "./types";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix marker icon default so it shows properly
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface MapProps {
  properties: Property[];
}

export default function MapInner({ properties }: MapProps) {
  return (
    <MapContainer
      center={[51.505, -0.09]}
      zoom={6}
      style={{ height: "500px", width: "100%", marginBottom: "2rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {properties.map((property) => (
        <Marker
          key={property.id}
          position={[
            property.latitude || 51.505, // fallback if no lat
            property.longitude || -0.09, // fallback if no lng
          ]}
        >
          <Popup>
            <strong>{property.title}</strong><br />
            £{property.price.toLocaleString()}<br />
            {property.location}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
