'use client';

import { useEffect, useState } from 'react';
import { Property } from '../../src/types';

interface InvestmentSummaryProps {
  property: Property;
}

export default function InvestmentSummary({ property }: InvestmentSummaryProps) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!property) return;

    const fetchSummary = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: property.title,
            location: property.location,
            price: property.price,
            yield_percent: property.yield_percent,
            roi_percent: property.roi_percent,
            investmentType: property.investmentType || '',
            propertyType: property.propertyType || '',
          }),
        });

        if (!res.ok) {
          console.error(`Failed to fetch summary: ${res.status}`);
          setSummary('An error occurred while generating the summary.');
          return;
        }

        const data = await res.json();
        setSummary(data.summary || 'No summary available.');
      } catch (err) {
        console.error('Fetch summary error:', err);
        setSummary('An error occurred while generating the summary.');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [property]);

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      padding: '16px',
      borderRadius: '10px',
      border: '1px solid #e2e8f0',
      marginTop: '24px',
    }}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b', marginBottom: '10px' }}>
        📈 Investment Summary
      </h2>
      {loading ? (
        <p style={{ color: '#64748b' }}>Generating smart investment summary...</p>
      ) : (
        <p style={{ fontSize: '15px', lineHeight: '1.6', color: '#334155' }}>{summary}</p>
      )}
    </div>
  );
}
