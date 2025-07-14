import React from "react";
import type { Property } from "../src/app/types";
import styles from "./PropertyCard.module.css";

interface PropertyCardProps {
  property: Property;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  return (
    <div className={styles.card}>
      <div className={styles.content}>
        <h2 className={styles.title}>{property.title}</h2>
        <p className={styles.location}>{property.location}</p>
        <p className={styles.price}>£{property.price.toLocaleString()}</p>
        {property.bedrooms !== undefined && (
          <p className={styles.details}>
            {property.bedrooms} beds {property.bathrooms ? `• ${property.bathrooms} baths` : ""}
          </p>
        )}
        <p className={styles.description}>{property.description}</p>
        <p className={styles.stats}>
          Yield: {property.yield_percent}% | ROI: {property.roi_percent}%
        </p>
        <div className={styles.buttons}>
          <button className={styles.save}>Save Deal</button>
          <button className={styles.detailsBtn}>View Details</button>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
