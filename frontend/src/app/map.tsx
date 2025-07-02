"use client";
<<<<<<< HEAD
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
});
=======

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
>>>>>>> d1ea4cb (Final: Add map and page updates, package fixes, clean scraper)

type Property = {
  id: string;
  title: string;
  location: string;
  price: number;
<<<<<<< HEAD
};

type Props = {
  properties: Property[];
};

export default function Map({ properties }: Props) {
  // Example: parse postcodes into approximate lat/lng manually
  const exampleMarkers = [
    { lat: 53.8008, lng: -1.5491, title: "Leeds" },
    { lat: 51.5074, lng: -0.1278, title: "London" },
    { lat: 52.4862, lng: -1.8904, title: "Birmingham" },
  ];

  return (
    <MapContainer center={[53.8, -1.5]} zoom={6} style={{ height: "500px", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {exampleMarkers.map((marker, idx) => (
        <Marker key={idx} position={[marker.lat, marker.lng]}>
          <Popup>{marker.title}</Popup>
=======
  description: string;
  latitude: number;
  longitude: number;
};

export default function Map() {
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch("https://propnexus-backend-production.up.railway.app/properties");
        const data = await res.json();

        // Fallback example coordinates if missing
        const withCoords = data.map((prop: any) => ({
          ...prop,
          latitude: prop.latitude || 53.8008, // fallback: Leeds
          longitude: prop.longitude || -1.5491,
        }));

        setProperties(withCoords);
      } catch (error) {
        console.error("Error fetching properties:", error);
      }
    };

    fetchProperties();
  }, []);

  const customIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  return (
    <MapContainer center={[53.8, -1.55]} zoom={6} style={{ height: "80vh", width: "100%" }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {properties.map((prop) => (
        <Marker
          key={prop.id}
          position={[prop.latitude, prop.longitude]}
          icon={customIcon}
        >
          <Popup>
            <strong>{prop.title}</strong><br />
            £{prop.price.toLocaleString()}<br />
            {prop.location}
          </Popup>
>>>>>>> d1ea4cb (Final: Add map and page updates, package fixes, clean scraper)
        </Marker>
      ))}
    </MapContainer>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> d1ea4cb (Final: Add map and page updates, package fixes, clean scraper)
