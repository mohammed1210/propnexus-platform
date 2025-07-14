"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { Property } from "../types";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";

interface MapProps {
  properties: Property[];
}

export default function MapInner({ properties }: MapProps) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Only run on client side
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
    }
  }, []);

  if (properties.length === 0) {
    return <p>No properties with location data found.</p>;
  }

  return (
    <MapContainer
      center={[51.505, -0.09]} // default center, you can change
      zoom={6}
      scrollWheelZoom={true}
      style={{ height: "500px", width: "100%", marginBottom: "2rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {properties.map((property) => (
        <Marker
          key={property.id}
          position={[property.latitude, property.longitude]}
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