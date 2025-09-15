'use client';
import { useEffect, useMemo, useState } from 'react';
import { Property } from '@/types';

export default function InvestmentSummary({ property }: { property: Property }) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (!property) return;
    if (!BACKEND_BASE) {
      setSummary(`£${property.price?.toLocaleString()} • Yield ${property.yield_percent ?? 'N/A'}% • ROI ${property.roi_percent ?? 'N/A'}%`);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BACKEND_BASE}/generate-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(property),
        });
        const data = await res.json();
        setSummary(data.summary ?? 'No summary available');
      } catch {
        setSummary(`£${property.price?.toLocaleString()} • Yield ${property.yield_percent ?? 'N/A'}% • ROI ${property.roi_percent ?? 'N/A'}%`);
      } finally {
        setLoading(false);
      }
    })();
  }, [property, BACKEND_BASE]);

  const { yieldScore, roiScore } = useMemo(() => {
    const y = property.yield_percent ?? 0;
    const r = property.roi_percent ?? 0;
    return {
      yieldScore: Math.min(100, (y / 12) * 100),
      roiScore: Math.min(100, (r / 25) * 100),
    };
  }, [property]);

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">📈 Investment Summary</h3>
      {loading ? <p className="animate-pulse">Loading…</p> : <p>{summary}</p>}
      <Progress label="Yield" score={yieldScore} />
      <Progress label="ROI" score={roiScore} />
    </div>
  );
}

function Progress({ label, score }: { label: string; score: number }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span>{Math.round(score)} / 100</span>
      </div>
      <div className="h-2 bg-slate-200 rounded">
        <div style={{ width: `${score}%` }} className="h-2 bg-gradient-to-r from-blue-500 to-green-500 rounded" />
      </div>
    </div>
  );
}
