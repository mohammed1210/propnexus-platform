"use client";

import React from "react";
import styles from "./PropertyCard.module.css";
import type { Property } from "../types";

export default function PropertyCard({ property }: { property: Property }) {
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{property.title}</h2>
      <p className={styles.location}>{property.location}</p>
      <p className={styles.price}>£{property.price.toLocaleString()}</p>
      <p className={styles.bedsBaths}>
        {property.bedrooms} beds • {property.bathrooms} baths
      </p>
      <p className={styles.description}>{property.description}</p>
      <p className={styles.metrics}>
        Yield: {property.yield ? `${property.yield}%` : "N/A"} | ROI: {property.roi ? `${property.roi}%` : "N/A"}
      </p>
      <div className={styles.buttonRow}>
        <button className={styles.saveButton}>Save Deal</button>
        <button className={styles.detailsButton}>View Details</button>
      </div>
    </div>
  );
}