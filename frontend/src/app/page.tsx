"use client";

import { useEffect, useState } from "react";
import PropertyCard from "../components/PropertyCard";
import MapInner from "./MapInner";
import styles from "./page.module.css";
import type { Property } from "../src/app/types";

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);

  // Example filters
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
    <div>
      <h1>Properties</h1>

      {/* Example simple filters */}
      <div className={styles.filters}>
        <label>
          Min Price:
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(Number(e.target.value))}
          />
        </label>
        <label>
          Max Price:
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          />
        </label>
      </div>

      {/* ✅ Pass full property list to map */}
      <MapInner properties={properties} />

      <div className={styles.listContainer}>
        {filteredProperties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  );
}