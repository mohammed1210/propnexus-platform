"use client";

import { Property } from "./types"; // ✅ use shared type

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type MapProps = {
  properties: Property[];
};

export default function Map({ properties }: MapProps) {
  return (
    <MapContainer center={[51.505, -0.09]} zoom={6} style={{ height: "500px", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
      />
      {properties.map((property) => (
        <Marker
          key={property.id}
          position={[property.latitude, property.longitude]}
        >
          <Popup>
            <strong>{property.title}</strong><br />
            {property.location} – £{property.price}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
