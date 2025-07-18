// app/properties/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Property } from '../../../types';

export default function PropertyDetailsPage() {
  const { id } = useParams();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/properties/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProperty(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (!property) return <p>Property not found.</p>;

  return (
    <div
      style={{
        maxWidth: '960px',
        margin: '40px auto',
        padding: '20px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
      }}
    >
      <img
        src={property.imageurl || '/placeholder.jpg'}
        alt={property.title}
        style={{ width: '100%', borderRadius: '10px', marginBottom: '20px' }}
      />
      <h1 style={{ fontSize: '28px', marginBottom: '10px' }}>{property.title}</h1>
      <p style={{ fontSize: '18px', color: '#64748b' }}>{property.location}</p>
      <p style={{ fontSize: '20px', fontWeight: 'bold' }}>
        £{property.price.toLocaleString()}
      </p>
      <p style={{ margin: '10px 0' }}>
        🛏 {property.bedrooms} beds • 🛁 {property.bathrooms} bath
      </p>
      <p style={{ marginBottom: '20px' }}>{property.description}</p>
      <div
        style={{
          display: 'flex',
          gap: '12px',
          backgroundColor: '#ecfdf5',
          padding: '10px 16px',
          borderRadius: '8px',
          fontWeight: 500,
          color: '#065f46',
        }}
      >
        📈 Yield: {property.yield_percent || 0}% | ROI: {property.roi_percent || 0}%
      </div>
    </div>
  );
}
