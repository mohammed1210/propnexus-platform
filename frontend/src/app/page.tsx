"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useEffect, useState } from "react";
import PropertyCard from "../../components/PropertyCard";
import MapInner from "./MapInner";
import type { Property } from "./types";
import styles from "./Page.module.css";

export const dynamic = "force-dynamic"; // ✅ Disable static prerender, fix window error

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

      <div style={{ marginBottom: "20px" }}>
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

      <div className={styles.mapWrapper}>
        <MapInner properties={filteredProperties} />
      </div>

      <div className={styles.cards}>
        {filteredProperties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  );
}