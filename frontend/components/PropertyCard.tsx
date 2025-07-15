import React from "react";
import type { Property } from "../src/app/types";
import styles from "./PropertyCard.module.css";

interface PropertyCardProps {
  property: Property;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{property.title || property.location}</h2>
      <p className={styles.location}>{property.location}</p>
      <p className={styles.price}>£{property.price.toLocaleString()}</p>

      {property.bedrooms !== undefined && (
        <p className={styles.info}>
          {property.bedrooms} beds • {property.bathrooms ?? 1} baths
        </p>
      )}

      {property.description && (
        <p className={styles.description}>{property.description}</p>
      )}

      <p className={styles.stats}>
        Yield: {property.yield_percent ? `${property.yield_percent}%` : "N/A"} | ROI: {property.roi_percent ? `${property.roi_percent}%` : "N/A"}
      </p>

      <div className={styles.buttons}>
        <button className={styles.save}>Save Deal</button>
        <button className={styles.details}>View Details</button>
      </div>
    </div>
  );
};

export default PropertyCard;