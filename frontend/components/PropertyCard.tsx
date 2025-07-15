import React from "react";
import styles from "./PropertyCard.module.css";
import type { Property } from "../src/app/types"; // ✅ corrected path

export default function PropertyCard({ property }: { property: Property }) {
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{property.title}</h2>
      <p className={styles.location}>{property.location}</p>
      <p className={styles.price}>£{property.price.toLocaleString()}</p>
      <p className={styles.details}>
        {property.bedrooms} beds • {property.bathrooms} baths
      </p>
      <p className={styles.description}>{property.description}</p>
      <p className={styles.metrics}>
      Yield: {property.yield_percent ? `${property.yield_percent}%` : "N/A"} | 
      ROI: {property.roi_percent ? `${property.roi_percent}%` : "N/A"}
      </p>
      <div className={styles.buttons}>
        <button className={styles.saveButton}>Save Deal</button>
        <button className={styles.viewButton}>View Details</button>
      </div>
    </div>
  );
}