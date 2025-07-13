import React from "react";
import type { Property } from "../app/types";
import styles from "./PropertyCard.module.css";

interface PropertyCardProps {
  property: Property;
}

export default function PropertyCard({ property }: PropertyCardProps) {
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{property.title}</h2>
      <p className={styles.address}>{property.address}</p>
      <p className={styles.price}>£{property.price.toLocaleString()}</p>
      <p className={styles.details}>
        {property.bedrooms} beds • {property.bathrooms} baths
      </p>
      <p className={styles.description}>{property.description}</p>
      <p className={styles.metrics}>
        Yield: {property.yield_percent}% | ROI: {property.roi_percent}%
      </p>
      <div className={styles.buttons}>
        <button className={styles.saveBtn}>Save Deal</button>
        <button className={styles.detailsBtn}>View Details</button>
      </div>
    </div>
  );
}
