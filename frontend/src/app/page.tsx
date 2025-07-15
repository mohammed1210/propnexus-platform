"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useEffect, useState } from "react";
import nextDynamic from "next/dynamic";
import PropertyCard from "../../components/PropertyCard";
import type { Property } from "./types";
import styles from "./Page.module.css";

const MapInner = nextDynamic(() => import("./MapInner"), { ssr: false });

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
  if (minPrice === 0 && maxPrice === 2000000) {
    setFilteredProperties(properties);
    return;
  }

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
        {filteredProperties.length > 0 ? (
          filteredProperties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))
        ) : (
          <p>No properties found within this range.</p>
        )}
      </div>
    </div>
  );
}