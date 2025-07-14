"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { Property } from "./types";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icon issue
delete (L.Icon.Default as any).prototype._getIconUrl;
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
    <MapContainer
      center={[52.3555, -1.1743]} // UK center
      zoom={6}
      style={{ height: "500px", width: "100%", marginBottom: "20px", borderRadius: "8px" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      {properties
        .filter((p) => p.latitude && p.longitude)
        .map((property) => (
          <Marker
            key={property.id}
            position={[property.latitude!, property.longitude!]}
          >
            <Popup>
              <strong>{property.title}</strong><br />
              £{property.price.toLocaleString()}<br />
              Yield: {property.yield_percent}% | ROI: {property.roi_percent}%
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}