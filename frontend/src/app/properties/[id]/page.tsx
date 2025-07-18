'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Property } from '../../../types';

export default function PropertyDetailPage() {
  const { id } = useParams();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/properties/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProperty(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch property:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <p style={{ padding: '20px' }}>Loading...</p>;
  }

  if (!property) {
    return <p style={{ padding: '20px' }}>Property not found.</p>;
  }

  return (
    <div
      style={{
        maxWidth: '960px',
        margin: '40px auto',
        padding: '20px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
      }}
    >
      <img
        src={property.imageurl || '/placeholder.jpg'}
        alt={property.title}
        style={{
          width: '100%',
          height: '360px',
          objectFit: 'cover',
          borderRadius: '10px',
          backgroundColor: '#f1f5f9',
          marginBottom: '20px',
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/placeholder.jpg';
        }}
      />

      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
        {property.title}
      </h1>
      <p style={{ fontSize: '18px', color: '#64748b' }}>{property.location}</p>
      <p style={{ fontSize: '22px', fontWeight: 600, marginTop: '12px' }}>
        £{property.price.toLocaleString()}
      </p>

      <div
        style={{
          marginTop: '16px',
          fontSize: '16px',
          color: '#475569',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px
