// frontend/components/property_details/CompsPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { getComps } from '@/lib/api';
import { FF } from '@/lib/flags';

interface CompsPanelProps {
  postcode: string;
}

interface CompsData {
  postcode: string;
  source?: 'db';
  match_level?: 'postcode' | 'outward' | 'none';
  count?: number;
  median_price?: number | null;
  median_rent?: number | null;
}

export default function CompsPanel({ postcode }: CompsPanelProps) {
  const enabled = FF.COMPS;

  const [data, setData] = useState<CompsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      return;
    }
    if (!postcode) {
      setData(null);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await getComps(postcode);
        setData(response);
      } catch (err) {
        console.error('Error fetching comps:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [postcode, enabled]);

  if (!enabled) return null;

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded"></div>
        <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-4/6"></div>
      </div>
    );
  }

  const count = typeof data?.count === 'number' ? data.count : 0;
  const hasAny =
    !!data &&
    (count > 0 ||
      (typeof data.median_price === 'number' && data.median_price > 0) ||
      (typeof data.median_rent === 'number' && data.median_rent > 0));

  if (!hasAny) {
    return (
      <div className="text-gray-600 dark:text-neutral-400">
        <p>No comparable sales data available</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Comparable Sales</h3>
        <span className="text-xs text-gray-500 dark:text-neutral-500 px-2 py-1 bg-gray-100 dark:bg-neutral-800 rounded">
          DB
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-1">
          <div className="text-xs text-gray-600 dark:text-neutral-400">Median Sale Price</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
            {typeof data?.median_price === 'number' && data.median_price > 0
              ? `£${Math.round(data.median_price).toLocaleString()}`
              : '—'}
          </div>
          <div className="text-xs text-gray-500 dark:text-neutral-500">
            {count} sample{count !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-600 dark:text-neutral-400">Median Rent/mo</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
            {typeof data?.median_rent === 'number' && data.median_rent > 0
              ? `£${Math.round(data.median_rent).toLocaleString()}`
              : '—'}
          </div>
          <div className="text-xs text-gray-500 dark:text-neutral-500">
            {data?.match_level ? `match: ${data.match_level}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
