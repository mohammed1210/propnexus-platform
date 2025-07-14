"use client";
import { useState } from "react";
import PropertyCard from "../components/PropertyCard";
import MapInner from "./MapInner";
import type { Property } from "../src/app/types";

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [showMap, setShowMap] = useState(true);

  // Example data for demonstration
  // Replace with your fetch logic if needed
  const exampleProperties: Property[] = [
    {
      id: "1",
      title: "3 Bed Detached House in Surrey",
      location: "G1 2FF",
      price: 150000,
      imageurl: "",
      description: "Detached house in a high-value area.",
      source: "Rightmove",
      yield_percent: 6,
      roi_percent: 15.4,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: "Detached",
      investmentType: "BTL",
      latitude: 51.3,
      longitude: -0.6,
      created_at: "",
    },
    {
      id: "2",
      title: "2 Bed Maisonette in Reading",
      location: "E14 5AB",
      price: 125000,
      imageurl: "",
      description: "Maisonette in Reading located in a high-yield area.",
      source: "Zoopla",
      yield_percent: 8.16,
      roi_percent: 9.2,
      bedrooms: 2,
      bathrooms: 2,
      propertyType: "Maisonette",
      investmentType: "Flip",
      latitude: 51.5,
      longitude: -0.9,
      created_at: "",
    },
  ];

  return (
    <div>
      <h1>Properties</h1>
      <button
        onClick={() => setShowMap(!showMap)}
        style={{
          marginBottom: "20px",
          padding: "10px 20px",
          background: "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        {showMap ? "Show List Only" : "Show Map + List"}
      </button>

      {showMap && <MapInner properties={exampleProperties} />}

      {exampleProperties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}