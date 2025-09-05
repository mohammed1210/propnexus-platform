'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './PropertyCard.module.css';
import { getSupabase } from '@/lib/supabaseClient';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

interface Property {
  id: string | null;
  title: string;
  location: string;
  price: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
}

interface Props {
  property: Property;
}

export default function PropertyCard({ property }: Props) {
  const fallbackImage = '/placeholder.jpg';

  const initial =
    property.imageurl && property.imageurl.startsWith('http')
      ? property.imageurl
      : fallbackImage;

  const [imgSrc, setImgSrc] = useState(initial);
  const pid = property.id ?? '';
  const href = pid ? `/property/${pid}` : undefined;

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();

    let sb;
    try {
      sb = getSupabase();
    } catch {
      alert('❌ Cannot save deal during prerender.');
      return;
    }

    const { error } = await sb.from('saved_deals').insert({
      user_id: 'demo-user',
      property_id: pid,
    });

    if (error) {
      console.error('Error saving deal:', error.message);
      alert('❌ Could not save this deal.');
    } else {
      alert('✅ Deal saved!');
    }
  };

  const CardInner = (
    <>
      <div className={styles.imageWrapper} style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
        <Image
          src={imgSrc || fallbackImage}
          alt={property.title || 'Property'}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className={styles.image}
          onError={() => setImgSrc(fallbackImage)}
          priority={false}
        />
      </div>

      <div className={styles.info}>
        <div className="flex items-start justify-between gap-3">
          <h2 className={styles.title}>{property.title}</h2>
          <Badge variant="info" aria-label="AI score beta">AI score • beta</Badge>
        </div>

        <p className={styles.location}>{property.location}</p>

        <p className={styles.price}>£{Number(property.price ?? 0).toLocaleString()}</p>

        {(property.bedrooms != null || property.bathrooms != null) && (
          <p className={styles.details} aria-label="Bedrooms and bathrooms">
            {property.bedrooms != null ? `🛏 ${property.bedrooms}` : ''}{' '}
            {property.bathrooms != null ? `• 🛁 ${property.bathrooms}` : ''}
          </p>
        )}

        <div className={styles.metrics}>
          <Badge variant="success" className="mr-2">Yield: {property.yield_percent ?? 0}%</Badge>
          <Badge variant="neutral">ROI: {property.roi_percent ?? 0}%</Badge>
        </div>

        <div className={styles.buttons}>
          <Button onClick={handleSave} variant="secondary" size="sm" leadingIcon={<span>💾</span>} aria-label="Save deal">
            Save Deal
          </Button>

          {href ? (
            <Link href={href} prefetch>
              <Button variant="primary" size="sm" leadingIcon={<span>🔍</span>}>View Details</Button>
            </Link>
          ) : (
            <Button variant="ghost" size="sm" disabled>View Details</Button>
          )}
        </div>
      </div>
    </>
  );

  // Keep the whole card clickable when we have an id; otherwise render a plain div
  return href ? (
    <Link href={href} className={styles.card} prefetch aria-label={property.title}>
      {CardInner}
    </Link>
  ) : (
    <div className={styles.card} aria-label={property.title}>{CardInner}</div>
  );
}