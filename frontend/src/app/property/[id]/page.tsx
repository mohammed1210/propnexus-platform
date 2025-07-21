'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Property } from '../../../types';
import supabase from '@lib/supabaseClient';

export default function PropertyDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id!;
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`https://propnexus-backend-production.up.railway.app/properties/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProperty(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    const userId = 'demo-user';
    const { error } = await supabase.from('saved_deals').insert({
      user_id: userId,
      property_id: property?.id,
    });

    if (error) {
      console.error('Error saving deal:', error.message);
      alert('Failed to save deal!');
    } else {
      alert('Deal saved!');
    }
  };

  const getAIScore = () => {
    const yieldScore = Math.min(property?.yield_percent || 0, 10) * 5;
    const roiScore = Math.min(property?.roi_percent || 0, 20) * 2.5;
    const bonus = (property?.price || 0) < 200000 ? 5 : 0;
    return Math.min(Math.round(yieldScore + roiScore + bonus), 100);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#facc15';
    return '#ef4444';
  };

  const handleDownload = () => {
    alert('🛠 Export to PDF coming soon...');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('🔗 Link copied to clipboard!');
  };

  if (!id) return <p>Invalid property ID.</p>;
  if (loading) return <p>Loading...</p>;
  if (!property) return <p>Property not found.</p>;

  const aiScore = getAIScore();
  const scoreColor = getScoreColor(aiScore);

  return (
    <div style={{
      maxWidth: '1280px',
      margin: '40px auto',
      padding: '24px',
      display: 'flex',
      flexDirection: 'row',
      gap: '32px',
    }}>
      <div style={{ flex: 2 }}>
        <button
          onClick={() => router.back()}
          style={{
            marginBottom: '20px',
            backgroundColor: '#e2e8f0',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#1e293b',
            fontWeight: '500',
          }}
        >
          ← Back to Listings
        </button>

        <img
          src={property.imageurl || '/placeholder.jpg'}
          alt={property.title}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '10px',
            marginBottom: '24px',
            backgroundColor: '#f1f5f9',
          }}
        />

        <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#0f172a' }}>
          {property.title}
        </h1>

        <div style={{ margin: '8px 0 16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{
            backgroundColor: scoreColor,
            color: '#fff',
            padding: '4px 12px',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '14px'
          }}>
            🔥 AI Score: {aiScore}/100
          </span>
        </div>

        <p style={{ fontSize: '18px', color: '#64748b', marginBottom: '8px' }}>
          {property.location}
        </p>
        <p style={{ fontSize: '24px', fontWeight: '600', color: '#0f172a' }}>
          £{property.price.toLocaleString()}
        </p>
        <p style={{ marginTop: '10px', fontSize: '16px', color: '#475569' }}>
          🛏 {property.bedrooms} beds • 🛁 {property.bathrooms || 0} bath
        </p>

        {property.latitude && property.longitude && (
          <div style={{ marginTop: '24px' }}>
            <iframe
              width="100%"
              height="240"
              style={{ borderRadius: '10px' }}
              loading="lazy"
              src={`https://maps.google.com/maps?q=${property.latitude},${property.longitude}&z=15&output=embed`}
            ></iframe>
          </div>
        )}

        <h2 style={{ marginTop: '28px', fontSize: '20px', color: '#1e293b', fontWeight: 600 }}>
          Description
        </h2>
        <p style={{
          marginTop: '8px',
          fontSize: '15px',
          lineHeight: '1.7',
          color: '#334155'
        }}>
          {property.description || 'No description available.'}
        </p>
      </div>

      <div style={{
        flex: 1,
        position: 'sticky',
        top: '40px',
        alignSelf: 'flex-start',
        padding: '20px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>
          Deal Summary
        </h3>

        <div><strong>Yield:</strong> {property.yield_percent || 0}%</div>
        <div><strong>ROI:</strong> {property.roi_percent || 0}%</div>
        <div><strong>Property Type:</strong> {property.propertyType || 'N/A'}</div>
        <div><strong>Investment Type:</strong> {property.investmentType || 'N/A'}</div>
        <div><strong>Source:</strong> {property.source || 'Unknown'}</div>

        <button onClick={handleSave} style={btnStyle}>💾 Save Deal</button>
        <button onClick={handleDownload} style={{ ...btnStyle, backgroundColor: '#3b82f6' }}>
          📥 Download Deal Pack
        </button>
        <button onClick={handleShare} style={{ ...btnStyle, backgroundColor: '#facc15', color: '#1f2937' }}>
          🔗 Copy Link
        </button>
      </div>
    </div>
  );
}

const btnStyle = {
  marginTop: '8px',
  backgroundColor: '#14b8a6',
  color: 'white',
  padding: '12px 20px',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 600,
  cursor: 'pointer',
  width: '100%',
  fontSize: '15px',
};
