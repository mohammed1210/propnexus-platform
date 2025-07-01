"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default Leaflet icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface Property {
  id: number;
  title: string;
  price: number;
  location: string;
  latitude: number;
  longitude: number;
}

export default function Map() {
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    fetch("https://propnexus-backend-production.up.railway.app/properties")
      .then((res) => res.json())
      .then((data) => {
        const mapped = data
          .map((p: any, idx: number) => ({
            id: idx,
            title: p.title || "Property",
            price: p.price,
            location: p.location,
            latitude: p.latitude,
            longitude: p.longitude,
          }))
          .filter(
            (p) =>
              typeof p.latitude === "number" &&
              typeof p.longitude === "number" &&
              !isNaN(p.latitude) &&
              !isNaN(p.longitude)
          );
        setProperties(mapped);
      })
      .catch((err) => console.error("Failed to fetch properties", err));
  }, []);

  return (
    <MapContainer center={[53.5, -2]} zoom={6} style={{ height: "600px", width: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {properties.map((prop) => (
        <Marker key={prop.id} position={[prop.latitude, prop.longitude]}>
          <Popup>
            <strong>{prop.title}</strong><br />
            £{prop.price}<br />
            {prop.location}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}