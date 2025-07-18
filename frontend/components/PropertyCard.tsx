// components/PropertyCard.tsx
'use client';

import React from 'react';
import styles from './PropertyCard.module.css';
import Link from 'next/link';
import { supabase } from '@lib/supabaseClient';

interface Property {
  id: string;
  title: string;
  location: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  yield_percent: number;
  roi_percent: number;
  imageurl?: string;
}

interface Props {
  property: Property;
}

export default function PropertyCard({ property }: Props) {
  const fallbackImage = '/placeholder.jpg';

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Link navigation

    // 🚧 TEMPORARY: No auth, so we use placeholder user ID
    const userId = 'demo-user'; // Replace with real session.user.id later

    const { error } = await supabase.from('saved_deals').insert({
      user_id: userId,
      property_id: property.id,
    });

    if (error) {
      console.error('Error saving deal:', error.message);
    } else {
      alert('Deal saved!');
    }
  };

  return (
    <Link href={`/property/${property.id}`} className={styles.card}>
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
          £{property.price?.toLocaleString?.() || 'N/A'}
        </div>

        <div className={styles.details}>
          🛏 {property.bedrooms} beds • 🛁 {property.bathrooms} bath
        </div>

        <div className={styles.metrics}>
          📈 Yield: {property.yield_percent || 0}% | ROI: {property.roi_percent || 0}%
        </div>

        <div className={styles.buttons}>
          <button className={styles.save} onClick={handleSave}>
            💾 Save Deal
          </button>
          <button className={styles.detailsBtn}>🔍 View Details</button>
        </div>
      </div>
    </Link>
  );
}
