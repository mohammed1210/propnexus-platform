'use client';

import { useEffect, useState } from 'react';
import { Property } from '@/types';

interface InvestmentSummaryProps {
  property: Property;
}

export default function InvestmentSummary({ property }: InvestmentSummaryProps) {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (!property || !BACKEND_BASE) {
      if (!BACKEND_BASE) {
        console.warn('NEXT_PUBLIC_API_URL is not set.');
      }
      return;
    }

    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND_BASE}/generate-summary`, {
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
          const text = await res.text();
          throw new Error(`Summary API ${res.status}: ${text}`);
        }

        const data = await res.json();
        const text =
          typeof data === 'string'
            ? data
            : data?.summary || 'No summary available.';
        setSummary(text);
      } catch (err) {
        console.error('Fetch summary error:', err);
        setSummary('An error occurred while generating the summary.');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [property, BACKEND_BASE]);

  return (
    <div>
      <h3 className="text-xl font-semibold mb-2">📈 Investment Summary</h3>
      {loading ? (
        <p className="text-slate-500">Generating smart investment summary…</p>
      ) : (
        <p className="leading-6 text-slate-700">{summary}</p>
      )}
    </div>
  );
}
