"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Property = {
  id: string;
  latitude?: number;
  longitude?: number;
  address: string;
  price: string;
};

type MapProps = {
  properties: Property[];
};

const Map = ({ properties }: MapProps) => {
  const defaultPosition: [number, number] = [51.505, -0.09]; // fallback center

  const validProperties = properties.filter(
    (p) =>
      typeof p.latitude === "number" &&
      !isNaN(p.latitude) &&
      typeof p.longitude === "number" &&
      !isNaN(p.longitude)
  );

  return (
    <MapContainer center={defaultPosition} zoom={6} style={{ height: "500px", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {validProperties.map((property) => (
        <Marker key={property.id} position={[property.latitude!, property.longitude!]}>
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
