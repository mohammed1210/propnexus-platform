import MapView from "./Map";
import PropertyCard from "../../components/PropertyCard";
import type { Property } from "./types";
import styles from "./Page.module.css";

export default function PropertiesPage() {
  const properties: Property[] = []; // Fetch or use props

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Properties</h1>
      <div className={styles.mapWrapper}>
        <MapView properties={properties} />
      </div>
      <div className={styles.cards}>
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  );
}