import React from "react";
import type { Property } from "../src/app/page";
import styles from "./PropertyCard.module.css";

export default function PropertyCard({ property }: { property: Property }) {
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{property.title}</h2>
      <p className={styles.location}>{property.location}</p>
      <p className={styles.price}>£{property.price.toLocaleString()}</p>
      <p className={styles.details}>
        🛏 {property.bedrooms} &nbsp;&nbsp;🛁 {property.bathrooms}
      </p>
      <p className={styles.description}>{property.description}</p>
      <p className={styles.metrics}>
        📈 Yield: {property.yield_percent}% &nbsp;&nbsp