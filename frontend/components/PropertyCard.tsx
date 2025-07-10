import styles from "./PropertyCard.module.css";
import type { Property } from "../src/app/types";

export default function PropertyCard({ property }: { property: Property }) {
  const {
    id,
    title,
    price,
    location,
    bedrooms,
    bathrooms,
    description,
    imageurl,
    yield_percent,
    roi_percent,
    source,
    propertyType,
    investmentType,
    latitude,
    longitude,
  } = property;

  return (
    <div className={styles.card}>
      <img
        src={imageurl || "/placeholder.jpg"}
        alt={title}
        className={styles.image}
      />
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.location}>{location}</p>
        <p className={styles.price}>£{price.toLocaleString()}</p>
        <p className={styles.details}>
          {bedrooms} beds • {bathrooms} baths
        </p>
        <p className={styles.description}>{description}</p>
        <p className={styles.description}>
          Yield: {yield_percent}% | ROI: {roi_percent}%
        </p>
        <p className={styles.details}>
          Investment Type: {investmentType || "N/A"}
        </p>
        <p className={styles.details}>
          Source: {source}
        </p>
        <div className={styles.buttons}>
          <button className={styles.button}>Save Deal</button>
          <button className={styles.buttonSecondary}>View Details</button>
        </div>
      </div>
    </div>
  );
}
