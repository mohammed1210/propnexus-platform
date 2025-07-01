"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const Map = ({ properties }: { properties: any[] }) => {
  const defaultPosition: [number, number] = [53.8, -1.5]; // example fallback

  const customIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  return (
    <MapContainer center={defaultPosition} zoom={6} style={{ height: "600px", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {properties.map((property, idx) => {
        if (!property.latitude || !property.longitude) return null;
        return (
          <Marker
            key={idx}
            position={[property.latitude, property.longitude]}
            icon={customIcon}
          >
            <Popup>
              <strong>{property.title}</strong><br />
              £{property.price}<br />
              {property.location}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

export default Map;
