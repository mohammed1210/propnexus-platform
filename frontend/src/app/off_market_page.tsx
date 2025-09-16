// This file implements the premium Off‑Market investor dashboard for the
// PropNexus platform.  Users can specify a location and budget and then
// generate off‑market property deals via the backend API.  The returned
// results are scored client‑side and displayed with simple filter controls.

'use client';

import { useState } from 'react';
import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';

type RawDeal = {
  address: string;
  price: number | string;
  description: string;
};

type Deal = RawDeal & { score: number; price: number };

export const dynamic = 'force-dynamic';

export default function OffMarketPage() {
  const [location, setLocation] = useState('London');
  const [budget, setBudget] = useState('500000');
  const [count, setCount] = useState(5);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState<string>('');

  async function generateDeals() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        location: location.trim() || 'London',
        budget: parseFloat(budget) || 0,
        count: count || 5,
      };
      const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || '';
      const res = await fetch(`${apiBase}/generate-off-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to fetch deals');
      const json = await res.json();
      // The API returns a stringified JSON array in the `deals` field.
      const rawList: RawDeal[] = JSON.parse(json.deals);
      const scored: Deal[] = rawList.map((d) => {
        const price = typeof d.price === 'string' ? parseFloat(d.price) : d.price;
        // Score deals inversely proportional to price relative to the budget.
        const score = price && body.budget
          ? Math.max(0, 1 - price / body.budget) * 100
          : 0;
        return { ...d, price, score: Math.round(score * 100) / 100 };
      });
      // sort highest score first
      scored.sort((a, b) => b.score - a.score);
      setDeals(scored);
    } catch (err: any) {
      setError(err?.message ?? 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  // Filter deals by max price if provided
  const filtered = deals.filter((d) => {
    const mp = parseFloat(maxPrice);
    return isNaN(mp) || d.price <= mp;
  });

  return (
    <div className="space-y-8">
      <Section>
        <SectionTitle>Off‑Market Deal Generator</SectionTitle>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <label className="block">
              <span className="text-sm font-medium">Location</span>
              <input
                type="text"
                className="mt-1 w-full border rounded px-3 py-2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Budget (£)</span>
              <input
                type="number"
                min="0"
                className="mt-1 w-full border rounded px-3 py-2"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium"># Deals</span>
              <input
                type="number"
                min="1"
                className="mt-1 w-full border rounded px-3 py-2"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
            <button
              onClick={generateDeals}
              disabled={loading}
              className="self-end bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded disabled:opacity-50"
            >
              {loading ? 'Generating…' : 'Generate Deals'}
            </button>
          </div>
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
        </div>
      </Section>

      {deals.length > 0 && (
        <Section>
          <SectionTitle>Results</SectionTitle>
          <div className="mb-4 flex items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-sm">Max price (£)</span>
              <input
                type="number"
                min="0"
                className="w-32 border rounded px-2 py-1"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </label>
            <span className="text-sm text-neutral-500">
              Showing {filtered.length} of {deals.length} deals
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((deal, idx) => (
              <article
                key={idx}
                className="border rounded-lg p-4 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-semibold text-lg mb-1">
                    {deal.address}
                  </h3>
                  <div className="text-sm text-neutral-600 mb-1">
                    £{deal.price.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </div>
                  <div className="text-xs text-neutral-500 mb-2">
                    Score: {deal.score.toFixed(2)}
                  </div>
                  <p className="text-sm text-neutral-700 line-clamp-5">
                    {deal.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}