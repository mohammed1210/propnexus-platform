"use client";

import { Property } from "./types";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type MapProps = {
  properties: Property[];
};

export default function Map({ properties }: MapProps) {
  const defaultPosition: [number, number] = [54.5, -3]; // Center of UK

  return (
    <MapContainer center={defaultPosition} zoom={6} style={{ height: "600px", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
      />
      {properties
        .filter((p) => p.latitude && p.longitude)
        .map((p) => (
          <Marker key={p.id} position={[p.latitude!, p.longitude!]} icon={L.icon({ iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png", iconSize: [25, 41], iconAnchor: [12, 41] })}>
            <Popup>
              <strong>{p.title}</strong><br />
              {p.address}<br />
              £{p.price}
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
