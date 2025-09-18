'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';

type Deal = {
  id: string;
  title?: string | null;
  location?: string | null;
  price?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
  saved_at?: string | null;
};

export const dynamic = 'force-dynamic';

export default function SavedDealsPage() {
  const [rows, setRows] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      const sb = getSupabase();
      const { data, error } = await sb
        .from('saved_deals')
        .select('*')
        .order('saved_at', { ascending: false }); // ✅ correct timestamp

      if (!ignore) {
        if (error) console.error('load saved_deals', error);
        setRows((data as Deal[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  return (
    <Section>
      <SectionTitle>Saved Deals</SectionTitle>
      {loading ? (
        <div className="p-4">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-4">No saved deals yet.</div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((d) => (
            <li key={d.id} className="rounded border border-zinc-200 p-4">
              <div className="font-medium">{d.title ?? '—'}</div>
              <div className="text-sm opacity-70">{d.location ?? '—'}</div>
              <div className="mt-1">£{(d.price ?? 0).toLocaleString()}</div>
              <div className="text-sm mt-1">
                Yield {d.yield_percent ?? '—'}% · ROI {d.roi_percent ?? '—'}%
              </div>
              <div className="text-xs opacity-70 mt-1">
                Saved {d.saved_at ? new Date(d.saved_at).toLocaleDateString() : '—'}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}