// frontend/components/property_details/CompsPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { getComps } from '@/lib/api';

interface CompsPanelProps {
  postcode: string;
}

interface CompSale {
  address: string;
  price: number;
  date: string;
  type: string;
  distance_km: number;
}

interface CompRent {
  address: string;
  price: number;
  date: string;
  type: string;
  distance_km: number;
}

interface CompsData {
  postcode: string;
  sales: CompSale[];
  rents: CompRent[];
  source?: 'provider' | 'cache';
}

export default function CompsPanel({ postcode }: CompsPanelProps) {
  const [data, setData] = useState<CompsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'provider' | 'cache'>('provider');

  useEffect(() => {
    if (!postcode) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await getComps(postcode);
        setData(response);
        if (response.source) {
          setSource(response.source);
        }
      } catch (err) {
        console.error('Error fetching comps:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [postcode]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded"></div>
        <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-4/6"></div>
      </div>
    );
  }

  if (!data || (!data.sales?.length && !data.rents?.length)) {
    return (
      <div className="text-gray-600 dark:text-neutral-400">
        <p>No comparable sales data available</p>
      </div>
    );
  }

  const avgSalePrice = data.sales.length
    ? data.sales.reduce((sum, s) => sum + s.price, 0) / data.sales.length
    : 0;

  const avgRentPrice = data.rents.length
    ? data.rents.reduce((sum, r) => sum + r.price, 0) / data.rents.length
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Comparable Sales</h3>
        <span className="text-xs text-gray-500 dark:text-neutral-500 px-2 py-1 bg-gray-100 dark:bg-neutral-800 rounded">
          {source === 'cache' ? '📦 Cached' : '🔴 Live'}
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-1">
          <div className="text-xs text-gray-600 dark:text-neutral-400">Avg Sale Price</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
            {avgSalePrice > 0 ? `£${Math.round(avgSalePrice).toLocaleString()}` : 'N/A'}
          </div>
          <div className="text-xs text-gray-500 dark:text-neutral-500">
            {data.sales.length} sale{data.sales.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-600 dark:text-neutral-400">Avg Rent/mo</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
            {avgRentPrice > 0 ? `£${Math.round(avgRentPrice).toLocaleString()}` : 'N/A'}
          </div>
          <div className="text-xs text-gray-500 dark:text-neutral-500">
            {data.rents.length} rental{data.rents.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Sales list */}
      {data.sales.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">
            Recent Sales
          </h4>
          <div className="space-y-2">
            {data.sales.slice(0, 3).map((sale, idx) => (
              <div
                key={idx}
                className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-md text-sm"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-gray-900 dark:text-neutral-100">
                    {sale.address}
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    £{sale.price.toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-gray-600 dark:text-neutral-400">
                  <span>{sale.type}</span>
                  <span>{sale.date}</span>
                  <span>{sale.distance_km.toFixed(2)} km</span>
                </div>
              </div>
            ))}
          </div>
          {data.sales.length > 3 && (
            <div className="text-xs text-gray-500 dark:text-neutral-500 mt-2">
              +{data.sales.length - 3} more sale{data.sales.length - 3 !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Rents list */}
      {data.rents.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">
            Recent Rentals
          </h4>
          <div className="space-y-2">
            {data.rents.slice(0, 3).map((rent, idx) => (
              <div
                key={idx}
                className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-md text-sm"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-gray-900 dark:text-neutral-100">
                    {rent.address}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    £{rent.price.toLocaleString()}/mo
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-gray-600 dark:text-neutral-400">
                  <span>{rent.type}</span>
                  <span>{rent.date}</span>
                  <span>{rent.distance_km.toFixed(2)} km</span>
                </div>
              </div>
            ))}
          </div>
          {data.rents.length > 3 && (
            <div className="text-xs text-gray-500 dark:text-neutral-500 mt-2">
              +{data.rents.length - 3} more rental{data.rents.length - 3 !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
