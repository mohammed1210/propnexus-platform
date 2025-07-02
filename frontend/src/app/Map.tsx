"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type Property = {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  price: string;
};

type MapProps = {
  properties: Property[];
};

const Map = ({ properties }: MapProps) => {
  const defaultPosition: [number, number] = [51.505, -0.09]; // fallback center (London)

  return (
    <MapContainer center={defaultPosition} zoom={6} style={{ height: "500px", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {properties
        .filter((p) => p.latitude !== undefined && p.longitude !== undefined)
        .map((property) => (
          <Marker key={property.id} position={[property.latitude, property.longitude]}>
            <Popup>
              <strong>{property.address}</strong>
              <br />
              Price: {property.price}
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
};

export default Map;
