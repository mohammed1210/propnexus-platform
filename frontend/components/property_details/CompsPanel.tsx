// frontend/components/property_details/CompsPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { getComps } from '@/lib/api';
import { FF } from '@/lib/flags';

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
  const [showAll, setShowAll] = useState(false);

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

  // Guard against missing or invalid sales/rents arrays
  const sales = Array.isArray(data?.sales) ? data.sales : [];
  const rents = Array.isArray(data?.rents) ? data.rents : [];

  if (!data || (sales.length === 0 && rents.length === 0)) {
    return (
      <div className="text-gray-600 dark:text-neutral-400">
        <p>No comparable sales data available</p>
      </div>
    );
  }

  const avgSalePrice = sales.length
    ? sales.reduce((sum, s) => sum + s.price, 0) / sales.length
    : 0;

  const avgRentPrice = rents.length
    ? rents.reduce((sum, r) => sum + r.price, 0) / rents.length
    : 0;

  const salesLimit = showAll ? sales.length : 2;
  const rentsLimit = showAll ? rents.length : 2;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Comparable Sales</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline"
            aria-label={showAll ? 'Collapse comparable sales' : 'View all comparable sales'}
          >
            {showAll ? 'Collapse comps' : 'View all comps'}
          </button>
          <span className="text-xs text-gray-500 dark:text-neutral-500 px-2 py-1 bg-gray-100 dark:bg-neutral-800 rounded">
            {source === 'cache' ? '📦 Cached' : '🔴 Live'}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-1">
          <div className="text-xs text-gray-600 dark:text-neutral-400">Avg Sale Price</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
            {avgSalePrice > 0 ? `£${Math.round(avgSalePrice).toLocaleString()}` : 'N/A'}
          </div>
          <div className="text-xs text-gray-500 dark:text-neutral-500">
            {sales.length} sale{sales.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-600 dark:text-neutral-400">Avg Rent/mo</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
            {avgRentPrice > 0 ? `£${Math.round(avgRentPrice).toLocaleString()}` : 'N/A'}
          </div>
          <div className="text-xs text-gray-500 dark:text-neutral-500">
            {rents.length} rental{rents.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Sales list */}
      {sales.length > 0 && (
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">
            Recent Sales
          </h4>
          <div className="space-y-2">
            {sales.slice(0, salesLimit).map((sale, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-gray-50 dark:bg-neutral-800 rounded-md text-[13px]"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-gray-900 dark:text-neutral-100">
                    {sale.address}
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    £{sale.price.toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-3 text-[11px] text-gray-600 dark:text-neutral-400 leading-snug">
                  <span>{sale.type}</span>
                  <span>{sale.date}</span>
                  <span>{sale.distance_km.toFixed(2)} km</span>
                </div>
              </div>
            ))}
          </div>
          {!showAll && sales.length > salesLimit && (
            <div className="text-xs text-gray-500 dark:text-neutral-500 mt-2">
              +{sales.length - salesLimit} more sale{sales.length - salesLimit !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Rents list */}
      {rents.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">
            Recent Rentals
          </h4>
          <div className="space-y-2">
            {rents.slice(0, rentsLimit).map((rent, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-gray-50 dark:bg-neutral-800 rounded-md text-[13px]"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-gray-900 dark:text-neutral-100">
                    {rent.address}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    £{rent.price.toLocaleString()}/mo
                  </span>
                </div>
                <div className="flex gap-3 text-[11px] text-gray-600 dark:text-neutral-400 leading-snug">
                  <span>{rent.type}</span>
                  <span>{rent.date}</span>
                  <span>{rent.distance_km.toFixed(2)} km</span>
                </div>
              </div>
            ))}
          </div>
          {!showAll && rents.length > rentsLimit && (
            <div className="text-xs text-gray-500 dark:text-neutral-500 mt-2">
              +{rents.length - rentsLimit} more rental{rents.length - rentsLimit !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
