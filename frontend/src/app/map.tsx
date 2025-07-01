"use client";
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

type Property = {
  id: string;
  title: string;
  location: string;
  price: number;
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
        </Marker>
      ))}
    </MapContainer>
  );
}
