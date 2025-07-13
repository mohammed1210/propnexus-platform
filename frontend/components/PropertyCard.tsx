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
      <p>{property.location}</p>
      <p>£{property.price.toLocaleString()}</p>
      <p>{property.bedrooms} beds • {property.bathrooms ?? "N/A"} baths</p>
      <p>{property.description}</p>
      <p>Yield: {property.yield_percent}% | ROI: {property.roi_percent}%</p>
      <button>Save Deal</button>
      <button>View Details</button>
    </div>
  );
};

export default PropertyCard;