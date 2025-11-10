'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { apiPost } from '@/lib/api';
import AddDealForm from '@/components/offMarket/AddDealForm';
import Image from 'next/image';
import { LuBedDouble, LuBath, LuSparkles, LuPlus, LuChevronDown, LuChevronUp } from 'react-icons/lu';

type OffMarket = {
  id: string;
  title?: string | null;
  location?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  investment_type?: string | null;
  contact?: string | null;
  source?: string | null;
  notes?: string | null;
  created_at?: string | null;
  image_url?: string | null;
};

export default function OffMarketContent() {
  const [rows, setRows] = useState<OffMarket[]>([]);
  const [loading, setLoading] = useState(true);

  // Generator form state
  const [loc, setLoc] = useState('Liverpool');
  const [budget, setBudget] = useState<string>('250000');
  const [count, setCount] = useState<string>('3');
  const [generating, setGenerating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const sb = useMemo(() => getSupabase(), []);

  // Load existing deals
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      const { data, error } = await sb
        .from('off_market_deals')
        .select('*')
        .order('created_at', { ascending: false });

      if (!ignore) {
        if (error) console.error('[OffMarket] Load error:', error);
        setRows((data as OffMarket[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [sb]);

  const refreshRows = useCallback(async () => {
    const { data } = await sb
      .from('off_market_deals')
      .select('*')
      .order('created_at', { ascending: false});
    setRows((data as OffMarket[]) ?? []);
  }, [sb]);

  // Generate deals via backend
  const generateDeals = async () => {
    const numBudget = Number(budget || 0);
    const numCount = Math.max(1, Math.min(10, Number(count || 3)));
    if (!loc || !Number.isFinite(numBudget)) {
      alert('Please enter a location and a valid budget.');
      return;
    }

    setGenerating(true);
    try {
      const res: { deals: any[] } = await apiPost('/off-market/generate-off-market', {
        location: loc,
        budget: numBudget,
        count: numCount,
      });

      const parsed = Array.isArray(res.deals) ? res.deals : [];
      if (parsed.length === 0) throw new Error('Generator returned no deals.');

      const nowIso = new Date().toISOString();
      const payload = parsed.map((p: any, i: number) => ({
        title: p.title || p.address || `Off-market deal ${i + 1}`,
        location: p.location || loc,
        price: Number(p.price ?? p.asking_price ?? 0) || null,
        bedrooms: p.bedrooms != null ? Number(p.bedrooms) : null,
        bathrooms: p.bathrooms != null ? Number(p.bathrooms) : null,
        investment_type: p.investment_type || 'HMO',
        contact: p.contact || null,
        source: 'AI generated',
        notes: p.description || p.notes || null,
        created_at: nowIso,
        image_url: null,
      }));

      const existingKey = new Set(
        rows.map((r) => `${(r.title || '').trim().toLowerCase()}|${r.price ?? ''}`),
      );
      const toInsert = payload.filter(
        (d) => !existingKey.has(`${(d.title || '').trim().toLowerCase()}|${d.price ?? ''}`),
      );
      if (toInsert.length === 0) {
        alert('No new unique deals to insert.');
        return;
      }

      const { data, error } = await sb.from('off_market_deals').insert(toInsert).select('*');
      if (error) throw error;

      setRows((prev) => [...(data as OffMarket[]), ...prev]);
    } catch (err: any) {
      console.error('[OffMarket] Generate error:', err);
      alert(err?.message || 'Failed to generate / save deals.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-[1920px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Off-Market Deals
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Private deals and AI-generated opportunities
          </p>
        </div>

        {/* AI Generator */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6 sticky top-0 z-30">
          <div className="flex items-center gap-3 mb-4">
            <LuSparkles className="w-6 h-6 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI Deal Generator
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Location (e.g., Liverpool)"
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
            />
            <input
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Budget (£)"
              inputMode="numeric"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <input
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Count (1-10)"
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
            <button
              onClick={generateDeals}
              disabled={generating}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 focus:ring-4 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {generating ? (
                <>
                  <LuSparkles className="inline w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <LuSparkles className="inline w-4 h-4 mr-2" />
                  Generate Deals
                </>
              )}
            </button>
          </div>
        </div>

        {/* Manual Add Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <LuPlus className="w-5 h-5 text-indigo-600" />
              <span className="font-semibold text-gray-900 dark:text-white">
                Add Off-Market Deal Manually
              </span>
            </div>
            {showAddForm ? (
              <LuChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <LuChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {showAddForm && (
            <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <AddDealForm onCreated={refreshRows} />
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState onGenerate={generateDeals} generating={generating} />
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {rows.length} {rows.length === 1 ? 'Deal' : 'Deals'}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rows.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DealCard({ deal }: { deal: OffMarket }) {
  return (
    <div className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-300">
      {/* Image */}
      <div className="relative aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-gray-700">
        {deal.image_url ? (
          <Image
            src={deal.image_url}
            alt={deal.title || 'Off-market property'}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            No image
          </div>
        )}
        
        {/* Investment Type */}
        {deal.investment_type && (
          <div className="absolute bottom-3 left-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/90 dark:bg-gray-900/90 text-gray-900 dark:text-white backdrop-blur-md shadow-lg">
              {deal.investment_type}
            </span>
          </div>
        )}

        {/* Source Badge */}
        {deal.source && (
          <div className="absolute top-3 right-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 backdrop-blur-md shadow-lg">
              {deal.source}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 space-y-3">
        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatPrice(deal.price)}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2">
          {deal.title || 'Untitled deal'}
        </h3>

        {/* Location */}
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
          📍 {deal.location || 'Location not specified'}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          {deal.bedrooms != null && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
              <LuBedDouble className="w-4 h-4" />
              <span className="font-medium">{deal.bedrooms}</span>
            </div>
          )}
          {deal.bathrooms != null && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
              <LuBath className="w-4 h-4" />
              <span className="font-medium">{deal.bathrooms}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {deal.notes && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            {deal.notes}
          </p>
        )}

        {/* Contact */}
        {deal.contact && (
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
            📞 {deal.contact}
          </p>
        )}
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

function EmptyState({ onGenerate, generating }: { onGenerate: () => void; generating: boolean }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <LuSparkles className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No off-market deals yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Use the AI generator above to create potential deals or add one manually
        </p>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50"
        >
          Generate Your First Deal
        </button>
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
