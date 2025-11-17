// frontend/components/property_details/AreaIntelPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { getAreaIntel } from '@/lib/api';
import { FF } from '@/lib/flags';

interface AreaIntelPanelProps {
  areaKey: string;
}

interface AreaIntelData {
  key: string;
  population: number;
  avg_price: number;
  avg_rent: number;
  rental_yield_percent: number;
  crime_index: number;
  schools_rating: number;
  transport_links: string[];
  notes: string;
}

export default function AreaIntelPanel({ areaKey }: AreaIntelPanelProps) {
  const [data, setData] = useState<AreaIntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'provider' | 'cache'>('provider');

  useEffect(() => {
    if (!areaKey) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await getAreaIntel(areaKey);
        setData(response);
        // Detect source if returned in response
        if (response.source) {
          setSource(response.source);
        }
      } catch (err) {
        console.error('Error fetching area intel:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [areaKey]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded"></div>
        <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-4/6"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-gray-600 dark:text-neutral-400">
        <p>Area intelligence unavailable</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Area: {data.key}</h3>
        <span className="text-xs text-gray-500 dark:text-neutral-500 px-2 py-1 bg-gray-100 dark:bg-neutral-800 rounded">
          {source === 'cache' ? '📦 Cached' : '🔴 Live'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-1">
          <div className="text-xs text-gray-600 dark:text-neutral-400">Population</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
            {data.population.toLocaleString()}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-600 dark:text-neutral-400">Avg Price</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
            £{data.avg_price.toLocaleString()}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-600 dark:text-neutral-400">Avg Rent/mo</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
            £{data.avg_rent.toLocaleString()}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-600 dark:text-neutral-400">Rental Yield</div>
          <div className="text-lg font-semibold text-green-600 dark:text-green-400">
            {data.rental_yield_percent.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-700 dark:text-neutral-300">Crime Index</span>
          <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">
            {data.crime_index}/100
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              data.crime_index < 40 ? 'bg-green-500' : data.crime_index < 70 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${data.crime_index}%` }}
          ></div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-700 dark:text-neutral-300">Schools Rating</span>
          <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">
            {data.schools_rating.toFixed(1)}/5.0
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${(data.schools_rating / 5) * 100}%` }}
          ></div>
        </div>
      </div>

      {data.transport_links && data.transport_links.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-gray-600 dark:text-neutral-400 mb-2">Transport Links</div>
          <div className="flex flex-wrap gap-2">
            {data.transport_links.map((link, idx) => (
              <span
                key={idx}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded"
              >
                {link}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.notes && (
        <div className="text-xs text-gray-500 dark:text-neutral-500 italic">{data.notes}</div>
      )}
    </div>
  );
}
