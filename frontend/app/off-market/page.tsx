'use client';
import { useEffect, useState } from 'react';
import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import { getSupabase } from '@/lib/supabaseClient';

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
};

export const dynamic = 'force-dynamic';

export default function OffMarketPage() {
  const [rows, setRows] = useState<OffMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      const sb = getSupabase();
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
    return () => { ignore = true; };
  }, []);

  return (
    <Section>
      <SectionTitle>Off-Market Deals</SectionTitle>

      {loading ? (
        <div className="p-4">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-4">No off-market deals yet.</div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {rows.map(d => (
            <li
              key={d.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="font-medium">{d.title ?? '—'}</div>
                <span className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
                  {d.investment_type ?? '—'}
                </span>
              </div>
              <div className="text-sm opacity-70">{d.location ?? '—'}</div>

              <div className="mt-2 flex items-center justify-between">
                <div className="font-semibold">£{(d.price ?? 0).toLocaleString()}</div>
                <div className="text-xs opacity-70">
                  {d.bedrooms ?? 0} beds • {d.bathrooms ?? 0} baths
                </div>
              </div>

              {d.notes ? <p className="mt-2 text-sm">{d.notes}</p> : null}

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="opacity-70">{d.source ?? '—'}</span>
                {d.contact ? (
                  <a className="underline" href={`mailto:${d.contact}`}>Contact</a>
                ) : <span className="opacity-50">No contact</span>}
              </div>

              <div className="mt-2 text-xs opacity-60">
                Added {d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}