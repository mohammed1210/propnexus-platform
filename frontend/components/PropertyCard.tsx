import React from "react";
import type { Property } from "../src/app/types";
import styles from "./PropertyCard.module.css";

interface PropertyCardProps {
  property: Property;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{property.title}</h2>
      <p className={styles.location}>{property.location}</p>
      <p className={styles.price}>£{property.price.toLocaleString()}</p>
      {property.bedrooms !== undefined && (
        <p>
          {property.bedrooms} beds {property.bathrooms ? `• ${property.bathrooms} baths` : ""}
        </p>
      )}
      <p>{property.description}</p>
      <p>
        Yield: {property.yield_percent}% | ROI: {property.roi_percent}%
      </p>
      <div className={styles.buttons}>
        <button className={styles.save}>Save Deal</button>
        <button className={styles.details}>View Details</button>
      </div>
    </div>
  );
};

export default PropertyCard;