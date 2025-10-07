'use client';
import { useEffect, useState } from 'react';

type SummaryData = { summary: string } | null;

export default function InvestmentSummary({ property }: { property: any }) {
  const [data, setData] = useState<SummaryData>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/gpt/summary`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: property.title,
            location: property.location,
            price: property.price,
            yield_percent: property.yield_percent,
            roi_percent: property.roi_percent,
            investmentType: property.investment_type,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Request failed');
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (property?.title) fetchSummary();
  }, [property]);

  return (
    <section className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold mb-2">AI Investment Summary</h2>
      {loading && <p>Generating summary...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {data?.summary && (
        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
          {data.summary}
        </p>
      )}
    </section>
  );
}
