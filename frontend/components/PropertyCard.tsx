'use client';

import React from 'react';
import { Property } from '../src/app/types';
import styles from './PropertyCard.module.css';

export default function PropertyCard({ property }: { property: Property }) {
  const fallbackImage = '/placeholder.jpg'; // Make sure this exists in your public folder

  return (
    <div className={styles.card}>
      <img
        src={property.imageurl || fallbackImage}
        alt={property.title}
        className={styles.image}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.onerror = null;
          target.src = fallbackImage;
        }}
      />
      <div className={styles.info}>
        <h2 className={styles.title}>{property.title}</h2>
        <p className={styles.location}>{property.location}</p>
        <p className={styles.price}>£{property.price.toLocaleString()}</p>

        {property.bedrooms !== undefined && (
          <p className={styles.details}>
            🛏 {property.bedrooms} bed{property.bedrooms > 1 ? 's' : ''}
            {property.bathrooms
              ? ` • 🛁 ${property.bathrooms} bath${
                  property.bathrooms > 1 ? 's' : ''
                }`
              : ''}
          </p>
        )}

        <p className={styles.metrics}>
          📈 Yield: {property.yield_percent}% | ROI: {property.roi_percent}%
        </p>

        <div className={styles.buttons}>
          <button className={styles.save}>💾 Save Deal</button>
          <button className={styles.detailsBtn}>🔍 View Details</button>
        </div>
      </div>
    </div>
  );
}