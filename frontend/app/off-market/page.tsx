'use client';

import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import { API_BASE, apiPost, safeFetch } from '@/lib/api';
import AddDealForm from '@/components/offMarket/AddDealForm';
import OffMarketFilters from '@/components/offMarket/OffMarketFilters';
import OffMarketCard from '@/components/offMarket/OffMarketCard';
import OffMarketTable from '@/components/offMarket/OffMarketTable';
import type { DealFilters, OffMarketDeal, ViewMode } from '@/lib/offmarket/types';
import { ensureDerivedFields } from '@/lib/offmarket/utils';
import PageWrapper from '@/components/PageWrapper';

type DBRow = {
  id: string;
  title?: string | null;
  location?: string | null;
  asking_price?: number | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  investment_type?: string | null;
  contact?: string | null;
  contact_email?: string | null;
  source?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  score?: number | null;
  image_url?: string | null;
  imageurl?: string | null;
  address?: string | null;
  postcode?: string | null;
  estimated_value?: number | null;
  refurb_cost?: number | null;
  rent_potential?: number | null;
  discount_percent?: number | null;
  investment_score?: number | null;
  agent_name?: string | null;
  agent_phone?: string | null;
  status?: string | null;
};

export const dynamic = 'force-dynamic';

export default function OffMarketPage() {
  const [rows, setRows] = useState<DBRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DealFilters>({});
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [filtered, setFiltered] = useState<OffMarketDeal[]>([]);

  // generator form state
  const [loc, setLoc] = useState('Liverpool');
  const [budget, setBudget] = useState<string>('250000');
  const [count, setCount] = useState<string>('3');
  const [generating, setGenerating] = useState(false);

  const loadRows = async () => {
    const data = await safeFetch<DBRow[]>(`${API_BASE}/off-market?limit=200&sort=score_desc`);
    setRows((data as DBRow[]) ?? []);
  };

  // load existing
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      if (!ignore) {
        try {
          await loadRows();
        } catch (e) {
          console.error('off_market_leads', e);
          setRows([]);
        }
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const refreshRows = async () => {
    await loadRows();
  };

  // map db rows to UI model and apply filters
  useEffect(() => {
    const mapped: OffMarketDeal[] = (rows || []).map((r) => ({
      id: r.id,
      title: r.title || 'Untitled',
      location: r.location,
      asking_price: r.asking_price ?? null,
      price: (r.asking_price ?? r.price) ?? null,
      bedrooms: r.bedrooms ?? null,
      bathrooms: r.bathrooms ?? null,
      notes: r.notes ?? null,
      source: r.source ?? null,
      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
      image_url: (r.image_url ?? r.imageurl) ?? null,
      imageurl: (r.imageurl ?? r.image_url) ?? null,
      score: r.score ?? null,
      investment_score: (r.score ?? r.investment_score) ?? null,
      investment_type: r.investment_type ?? null,
      contact_email: (r.contact_email ?? r.contact) ?? null,

      address: r.address ?? null,
      postcode: r.postcode ?? null,
      estimated_value: r.estimated_value ?? null,
      refurb_cost: r.refurb_cost ?? null,
      rent_potential: r.rent_potential ?? null,
      discount_percent: r.discount_percent ?? null,
      agent_name: r.agent_name ?? null,
      agent_phone: r.agent_phone ?? null,
      status: r.status ?? null,
    }));

    let list = mapped.map(ensureDerivedFields);
    // filters
    if (filters.postcode) {
      const q = filters.postcode.toUpperCase().replace(/\s/g, '');
      list = list.filter((d) => (d.postcode || '').replace(/\s/g, '').includes(q));
    }
    if (Number.isFinite(filters.minPrice as number)) {
      list = list.filter((d) => (d.price ?? 0) >= (filters.minPrice as number));
    }
    if (Number.isFinite(filters.maxPrice as number)) {
      list = list.filter((d) => (d.price ?? 0) <= (filters.maxPrice as number));
    }
    if (Number.isFinite(filters.minBedrooms as number) && (filters.minBedrooms as number) > 0) {
      list = list.filter((d) => (d.bedrooms ?? 0) >= (filters.minBedrooms as number));
    }
    if (Number.isFinite(filters.minBathrooms as number) && (filters.minBathrooms as number) > 0) {
      list = list.filter((d) => (d.bathrooms ?? 0) >= (filters.minBathrooms as number));
    }
    if (Number.isFinite(filters.minDiscount as number) && (filters.minDiscount as number) > 0) {
      list = list.filter(
        (d) => (d.discount_percent ?? 0) >= (filters.minDiscount as number),
      );
    }
    if (Number.isFinite(filters.minScore as number) && (filters.minScore as number) > 0) {
      list = list.filter((d) => (d.investment_score ?? 0) >= (filters.minScore as number));
    }
    setFiltered(list);
  }, [rows, filters]);

  // generate via backend
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
        investment_type: 'HMO',
      });

      const parsed = Array.isArray(res.deals) ? res.deals : [];
      if (parsed.length === 0) throw new Error('Generator returned no deals.');

      // Backend already inserted; just merge results and refresh.
      setRows((prev) => [...(parsed as DBRow[]), ...prev]);
      await refreshRows();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to generate / save deals.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <PageWrapper showOrbs={true}>
      <Section>
        <SectionTitle>Off‑Market Deals</SectionTitle>
        <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
          Track and experiment with off‑market opportunities you or your agents uncover.
          Use the AI generator for ideas, then refine with filters to focus on the best deals.
        </p>

        {/* AI Generator toolbar */}
        <div className="mt-6 mb-6 rounded-2xl border border-zinc-200/80 bg-white/70 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/60 shadow-sm">
          <div className="px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                AI Deal Generator
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                Quickly draft new off‑market ideas by location and budget. Results will be added to your list below.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                className="w-40 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Location"
                value={loc}
                onChange={(e) => setLoc(e.target.value)}
              />
              <input
                className="w-32 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900"
                type="number"
                min={0}
                step={10000}
                placeholder="Budget (£)"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
              <input
                className="w-24 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900"
                type="number"
                min={1}
                max={10}
                placeholder="# deals"
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />

              <button
                onClick={generateDeals}
                disabled={generating}
                className="inline-flex items-center gap-1 rounded-lg bg-black px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-900 disabled:opacity-60"
              >
                {generating ? 'Generating…' : 'Generate deals'}
              </button>
            </div>
          </div>
        </div>

        {/* Manual add form */}
        <details className="mb-5 card">
          <summary className="cursor-pointer select-none font-medium">
            + Add Off‑Market Deal
          </summary>
          <div className="mt-3">
            <AddDealForm onCreated={refreshRows} />
          </div>
        </details>

        {/* Filters + View toggle */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <OffMarketFilters filters={filters} onFiltersChange={setFilters} />
          </div>
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-500">
                Showing{' '}
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {filtered.length}
                </span>{' '}
                of {rows.length} deals
              </div>
              <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 p-1 text-xs dark:border-zinc-700 dark:bg-zinc-900/40">
                <button
                  className={`px-3 py-1 rounded-full transition ${
                    viewMode === 'cards'
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                      : 'text-zinc-500'
                  }`}
                  onClick={() => setViewMode('cards')}
                >
                  Grid
                </button>
                <button
                  className={`px-3 py-1 rounded-full transition ${
                    viewMode === 'table'
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                      : 'text-zinc-500'
                  }`}
                  onClick={() => setViewMode('table')}
                >
                  List
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-4 card">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 card">No off‑market deals yet.</div>
            ) : viewMode === 'cards' ? (
              <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map((d) => (
                  <li key={d.id}>
                    <OffMarketCard deal={d} />
                  </li>
                ))}
              </ul>
            ) : (
              <OffMarketTable deals={filtered} />
            )}
          </div>
        </div>
      </Section>
    </PageWrapper>
  );
}
