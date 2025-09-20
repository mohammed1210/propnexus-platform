'use client';

import { useEffect, useMemo, useState } from 'react';
import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import { getSupabase } from '@/lib/supabaseClient';
import { apiPost } from '@/lib/api';
import AddDealForm from '@/components/offMarket/AddDealForm';

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
  image_url?: string | null; // ⬅️ show this at the top of the card if present
};

export const dynamic = 'force-dynamic';

export default function OffMarketPage() {
  const [rows, setRows] = useState<OffMarket[]>([]);
  const [loading, setLoading] = useState(true);

  // generator form state
  const [loc, setLoc] = useState('Liverpool');
  const [budget, setBudget] = useState<string>('250000');
  const [count, setCount] = useState<string>('3');
  const [generating, setGenerating] = useState(false);

  const sb = useMemo(() => getSupabase(), []);

  // load existing deals from Supabase
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      const { data, error } = await sb
        .from('off_market_deals')
        .select('*')
        .order('created_at', { ascending: false });

      if (!ignore) {
        if (error) console.error('off_market_deals', error);
        setRows((data as OffMarket[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [sb]);

  const refreshRows = async () => {
    const { data } = await sb
      .from('off_market_deals')
      .select('*')
      .order('created_at', { ascending: false });
    setRows((data as OffMarket[]) ?? []);
  };

  // call backend → upsert → refresh UI
  const generateDeals = async () => {
    const numBudget = Number(budget || 0);
    const numCount = Math.max(1, Math.min(10, Number(count || 3)));
    if (!loc || !Number.isFinite(numBudget)) {
      alert('Please enter a location and a valid budget.');
      return;
    }

    setGenerating(true);
    try {
      // Backend route (router has prefix "/off-market")
      const res: { deals: any[] } = await apiPost('/off-market/generate-off-market', {
        location: loc,
        budget: numBudget,
        count: numCount,
      });

      const parsed = Array.isArray(res.deals) ? res.deals : [];
      if (parsed.length === 0) {
        throw new Error('Generator returned no deals.');
      }

      // Map to our table shape
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
        image_url: null, // generator won’t provide this
      }));

      // simple de-dupe (same title+price)
      const existingKey = new Set(
        rows.map(r => `${(r.title || '').trim().toLowerCase()}|${r.price ?? ''}`)
      );
      const toInsert = payload.filter(
        d => !existingKey.has(`${(d.title || '').trim().toLowerCase()}|${d.price ?? ''}`)
      );

      if (toInsert.length === 0) {
        alert('No new unique deals to insert.');
        return;
      }

      const { data, error } = await sb.from('off_market_deals').insert(toInsert).select('*');
      if (error) throw error;

      // Prepend new rows
      setRows(prev => [ ...(data as OffMarket[]), ...prev ]);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to generate / save deals.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Section>
      <SectionTitle>Off-Market Deals</SectionTitle>

      {/* Sticky filter-like shell for generator */}
      <div className="sticky-filter">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2 justify-end">
          <input
            className="border rounded-lg px-3 py-2 w-[160px]"
            placeholder="Location"
            value={loc}
            onChange={e => setLoc(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2 w-[120px]"
            placeholder="Budget £"
            inputMode="numeric"
            value={budget}
            onChange={e => setBudget(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2 w-[90px]"
            placeholder="Count"
            inputMode="numeric"
            value={count}
            onChange={e => setCount(e.target.value)}
          />
          <button
            onClick={generateDeals}
            disabled={generating}
            className="rounded-lg bg-indigo-600 text-white px-3 py-2 hover:bg-indigo-500 disabled:opacity-60"
          >
            {generating ? 'Generating…' : 'Generate Deals'}
          </button>
        </div>
      </div>

      {/* Manual add panel */}
      <details className="mb-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <summary className="cursor-pointer select-none font-medium">
          + Add Off-Market Deal
        </summary>
        <div className="mt-3">
          <AddDealForm onCreated={refreshRows} />
        </div>
      </details>

      {loading ? (
        <div className="p-4">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-4">No off-market deals yet.</div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {rows.map(d => (
            <li
              key={d.id}
              className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
            >
              {/* Photo */}
              {d.image_url ? (
                <div className="aspect-[16/10] w-full bg-zinc-100 dark:bg-zinc-800">
                  {/* Using <img> avoids remotePatterns config for next/image */}
                  <img
                    src={d.image_url}
                    alt={d.title || 'Off-market property image'}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="aspect-[16/10] w-full grid place-items-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-sm">
                  No photo
                </div>
              )}

              {/* Body */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="font-medium">{d.title ?? '—'}</div>
                  <span className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
                    {d.investment_type ?? '—'}
                  </span>
                </div>

                <div className="text-sm opacity-70">{d.location ?? '—'}</div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="font-semibold">£{Number(d.price ?? 0).toLocaleString()}</div>
                  <div className="text-xs opacity-70">
                    {d.bedrooms ?? 0} beds • {d.bathrooms ?? 0} baths
                  </div>
                </div>

                {d.notes ? <p className="mt-2 text-sm">{d.notes}</p> : null}

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="opacity-70">{d.source ?? '—'}</span>
                  {d.contact ? (
                    <a className="underline" href={`mailto:${d.contact}`}>Contact</a>
                  ) : (
                    <span className="opacity-50">No contact</span>
                  )}
                </div>

                <div className="mt-2 text-xs opacity-60">
                  Added {d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
