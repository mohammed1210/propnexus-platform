"use client";

import { useEffect, useState } from "react";
import PropertyCard from "../../components/PropertyCard";
import MapInner from "./MapInner";
import type { Property } from "../types";
import styles from "./Page.module.css";

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(2000000);

  useEffect(() => {
    fetch("/api/properties")
      .then((res) => res.json())
      .then((data) => {
        setProperties(data);
        setFilteredProperties(data);
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    const newFiltered = properties.filter(
      (prop) => prop.price >= minPrice && prop.price <= maxPrice
    );
    setFilteredProperties(newFiltered);
  }, [minPrice, maxPrice, properties]);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Properties</h1>

      {/* ✅ Filters block wrapped in styled container */}
      <div
        style={{
          backgroundColor: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
          padding: "15px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          marginBottom: "20px",
        }}
      >
        <label>
          Min Price:
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(Number(e.target.value))}
            style={{ marginLeft: "5px", marginRight: "10px" }}
          />
        </label>
        <label>
          Max Price:
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            style={{ marginLeft: "5px" }}
          />
        </label>
      </div>

      {/* ✅ Sort or toggle block example (can expand later) */}
      <div
        style={{
          backgroundColor: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
          padding: "10px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          marginBottom: "20px",
        }}
      >
        <button style={{ marginRight: "10px" }}>Sort: Newest</button>
        <button>Toggle View: Map/List</button>
      </div>

      <div className={styles.mapWrapper}>
        <MapInner properties={properties} />
      </div>

      <div className={styles.cards}>
        {filteredProperties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  );
}
