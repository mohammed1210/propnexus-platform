'use client';

import React from 'react';
import styles from './PropertyCard.module.css';
import Link from 'next/link';
import { useSupabase } from '../lib/supabaseClient'; // Adjust if in different location
import { useSession } from '@supabase/auth-helpers-react';

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
  const supabase = useSupabase();
  const session = useSession();

  const handleSaveDeal = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // Prevent link navigation

    if (!session?.user) {
      alert('You must be logged in to save a deal.');
      return;
    }

    const { error } = await supabase.from('saved_deals').insert({
      user_id: session.user.id,
      property_id: property.id,
      saved_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error saving deal:', error.message);
      alert('Failed to save deal. Please try again.');
    } else {
      alert('✅ Deal saved!');
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
          <button className={styles.save} onClick={handleSaveDeal}>
            💾 Save Deal
          </button>
          <button className={styles.detailsBtn}>🔍 View Details</button>
        </div>
      </div>
    </Link>
  );
}