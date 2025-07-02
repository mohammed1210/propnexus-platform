"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";

type Property = {
  id: string;
  title: string;
  location: string;
  price: number;
  description: string;
  latitude: number;
  longitude: number;
};

const customIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function Map() {
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch("https://propnexus-backend-production.up.railway.app/properties");
        const data = await res.json();

        const withCoords = data.map((prop: any) => ({
          ...prop,
          latitude: prop.latitude || 53.8008,
          longitude: prop.longitude || -1.5491,
        }));

        setProperties(withCoords);
      } catch (error) {
        console.error("Error fetching properties:", error);
      }
    };

    fetchProperties();
  }, []);

  return (
    <MapContainer center={[53.8, -1.55]} zoom={6} style={{ height: "80vh", width: "100%" }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {properties.map((prop) => (
        <Marker key={prop.id} position={[prop.latitude, prop.longitude]} icon={customIcon}>
          <Popup>
            <strong>{prop.title}</strong><br />
            £{prop.price.toLocaleString()}<br />
            {prop.location}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
