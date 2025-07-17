'use client';

import React from 'react';
import styles from './PropertyCard.module.css';

interface Property {
  id: string;
  title: string;
  location: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  yield: number;
  roi: number;
  imageurl?: string;
}

interface Props {
  property: Property;
}

export default function PropertyCard({ property }: Props) {
  const fallbackImage = '/placeholder.jpg'; // Add this to your /public folder if needed

  return (
    <div className={styles.card}>
      <img
        src={property.imageurl || fallbackImage}
        alt={property.title}
        className={styles.image}
        onError={(e) => {
          (e.target as HTMLImageElement).src = fallbackImage;
        }}
      />

      <div className={styles.info}>
        <div className={styles.title}>{property.title}</div>
        <div className={styles.location}>{property.location}</div>
        <div className={styles.price}>
          £{property.price.toLocaleString()}
        </div>

        <div className={styles.details}>
          🛏 {property.bedrooms} beds • 🛁 {property.bathrooms} bath
        </div>

        <div className={styles.metrics}>
          📈 Yield: {property.yield || 0}% | ROI: {property.roi || 0}%
        </div>

        <div className={styles.buttons}>
          <button className={styles.save}>💾 Save Deal</button>
          <button className={styles.detailsBtn}>🔍 View Details</button>
        </div>
      </div>
    </div>
  );
}