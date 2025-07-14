"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { Property } from "./types";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";

// Fix Leaflet default icon issues
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
});

interface MapInnerProps {
  properties: Property[];
}

export default function MapInner({ properties }: MapInnerProps) {
  useEffect(() => {
    // Just to ensure client code runs
  }, []);

  return (
    <MapContainer center={[51.505, -0.09]} zoom={6} style={{ height: "500px", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
      />
      {properties.map((property) => (
        property.latitude !== undefined &&
        property.longitude !== undefined && (
          <Marker
            key={property.id}
            position={[property.latitude as number, property.longitude as number]}
          >
            <Popup>
              <strong>{property.title}</strong>
              <br />
              £{property.price.toLocaleString()}
            </Popup>
          </Marker>
        )
      ))}
    </MapContainer>
  );
}