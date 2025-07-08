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
    image,
    yieldValue,
    roi,
    latitude,
    longitude,
  } = property;

  return (
    <div className={styles.card}>
      <img
        src={image || "/placeholder.jpg"}
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
        <p>Yield: {yieldValue}% | ROI: {roi}%</p>
        <div className={styles.buttons}>
          <button className={styles.button}>Save Deal</button>
          <button className={styles.buttonSecondary}>View Details</button>
        </div>
      </div>
    </div>
  );
}