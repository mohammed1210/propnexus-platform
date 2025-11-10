'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchWithRetry } from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';
import { LuBedDouble, LuBath, LuTrendingUp, LuPercent, LuTrash2 } from 'react-icons/lu';
import { FiHeart } from 'react-icons/fi';

type Deal = {
  id: string;
  property_id: string | null;
  title?: string | null;
  location?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
  saved_at?: string | null;
  investment_type?: string | null;
};

/** Resolve the FastAPI base URL from public env, with safe fallbacks. */
function getBackendBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    '') as string;

  if (!raw && typeof window !== 'undefined') {
    return window.location.origin.replace(/\/+$/, '');
  }
  return (raw || 'http://127.0.0.1:8000').replace(/\/+$/, '');
}

export default function SavedDealsContent() {
  const [rows, setRows] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const base = getBackendBase();
        const resp = await fetchWithRetry(`${base}/saved-deals`, { cache: 'no-store' });
        const list = await resp.json();
        const items = Array.isArray(list) ? list : ((list as any)?.data ?? []);
        if (!cancelled) setRows(items);
      } catch (err) {
        console.error('[SavedDeals] Error loading deals:', err);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const removeDeal = useCallback(async (id: string) => {
    if (!window.confirm('Remove this saved deal?')) return;
    const prev = rows;
    setBusyId(id);
    setRows((r) => r.filter((x) => x.id !== id));
    try {
      const base = getBackendBase();
      const resp = await fetchWithRetry(`${base}/saved-deals/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!resp.ok) throw new Error(`Delete failed: ${resp.status}`);
    } catch (err) {
      console.error('[SavedDeals] Delete error:', err);
      setRows(prev);
      window.alert('Sorry — failed to remove. Please try again.');
    } finally {
      setBusyId(null);
    }
  }, [rows]);

  const kpis = useMemo(() => {
    const count = rows.length;
    const avgYield = avg(rows.map((d) => num(d.yield_percent)));
    const avgRoi = avg(rows.map((d) => num(d.roi_percent)));
    const totalValue = rows.reduce((s, d) => s + num(d.price), 0);
    return { count, avgYield, avgRoi, totalValue };
  }, [rows]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-[1920px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Saved Deals
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Properties you&apos;ve saved for later review
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-2">
              <FiHeart className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Saved</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpis.count}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-2">
              <LuPercent className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Yield</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {kpis.avgYield ? `${kpis.avgYield.toFixed(1)}%` : '—'}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-2">
              <LuTrendingUp className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg ROI</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {kpis.avgRoi ? `${kpis.avgRoi.toFixed(1)}%` : '—'}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">💰</span>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Value</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatPrice(kpis.totalValue)}
            </p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rows.map((deal) => (
              <DealCard 
                key={deal.id} 
                deal={deal} 
                onRemove={removeDeal}
                busy={busyId === deal.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DealCard({ deal, onRemove, busy }: { deal: Deal; onRemove: (id: string) => void; busy: boolean }) {
  const getBadgeColor = (value: number, type: 'yield' | 'roi') => {
    const threshold = type === 'yield' ? 6 : 12;
    const mediumThreshold = type === 'yield' ? 4 : 8;
    
    if (value >= threshold) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    if (value >= mediumThreshold) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  return (
    <div className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-300">
      {/* Image */}
      <Link href={`/property/${deal.property_id}`} className="block">
        <div className="relative aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-gray-700">
          <Image
            src={deal.imageurl || '/placeholder.jpg'}
            alt={deal.title || 'Property'}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
          
          {/* Badges */}
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            {typeof deal.yield_percent === 'number' && (
              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-md shadow-lg ${getBadgeColor(deal.yield_percent, 'yield')}`}>
                <LuPercent className="inline w-3 h-3 mr-1" />
                {deal.yield_percent.toFixed(1)}% Yield
              </span>
            )}
            {typeof deal.roi_percent === 'number' && (
              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-md shadow-lg ${getBadgeColor(deal.roi_percent, 'roi')}`}>
                <LuTrendingUp className="inline w-3 h-3 mr-1" />
                {deal.roi_percent.toFixed(1)}% ROI
              </span>
            )}
          </div>

          {/* Investment Type */}
          {deal.investment_type && (
            <div className="absolute bottom-3 left-3">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/90 dark:bg-gray-900/90 text-gray-900 dark:text-white backdrop-blur-md shadow-lg">
                {deal.investment_type}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-5 space-y-3">
        {/* Price & Remove */}
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatPrice(deal.price)}
          </span>
          <button
            onClick={() => onRemove(deal.id)}
            disabled={busy}
            className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors disabled:opacity-50"
            aria-label="Remove saved deal"
          >
            <LuTrash2 className="w-5 h-5" />
          </button>
        </div>

        {/* Title */}
        <Link href={`/property/${deal.property_id}`}>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            {deal.title || 'Untitled property'}
          </h3>
        </Link>

        {/* Location */}
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
          📍 {deal.location || 'Location not specified'}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <LuBedDouble className="w-4 h-4" />
            <span className="font-medium">{deal.bedrooms || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <LuBath className="w-4 h-4" />
            <span className="font-medium">{deal.bathrooms || 0}</span>
          </div>
          {deal.saved_at && (
            <span className="text-xs text-gray-500 dark:text-gray-500 ml-auto">
              Saved {new Date(deal.saved_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
          <div className="aspect-[16/9] bg-gray-200 dark:bg-gray-700" />
          <div className="p-5 space-y-3">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            <div className="flex gap-4 pt-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <FiHeart className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No saved deals yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Start saving properties from the listings page
        </p>
        <Link 
          href="/listings"
          className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all"
        >
          Browse Listings
        </Link>
      </div>
    </div>
  );
}

function formatPrice(price?: number | null) {
  if (!price) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(price);
}

function num(val: any): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function avg(arr: number[]): number | null {
  const valid = arr.filter((x) => x > 0);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
