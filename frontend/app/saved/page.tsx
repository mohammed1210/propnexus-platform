'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import Link from 'next/link';

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
        .order('saved_at', { ascending: false });

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
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {rows.map((d) => (
            <li
              key={d.id}
              className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition"
            >
              {/* image */}
              <div className="aspect-[16/9] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.imageurl ?? 'https://placehold.co/640x360?text=PropNexus'}
                  alt={d.title ?? 'Property'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* body */}
              <div className="p-4 space-y-2">
                <Link
                  href={d.property_id ? `/property/${d.property_id}` : '#'}
                  className="block font-medium hover:underline"
                >
                  {d.title ?? '—'}
                </Link>
                <div className="text-sm opacity-70">{d.location ?? '—'}</div>

                <div className="flex items-center justify-between pt-1">
                  <div className="font-semibold">
                    £{(d.price ?? 0).toLocaleString()}
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                      Yield {d.yield_percent ?? '—'}%
                    </span>
                    <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
                      ROI {d.roi_percent ?? '—'}%
                    </span>
                  </div>
                </div>

                <div className="text-xs opacity-70">
                  {d.bedrooms ?? 0} beds • {d.bathrooms ?? 0} baths
                </div>

                <div className="text-xs opacity-60">
                  Saved {d.saved_at ? new Date(d.saved_at).toLocaleDateString() : '—'}
                </div>

                <div className="pt-2 flex gap-2">
                  <Link
                    href={d.property_id ? `/property/${d.property_id}` : '#'}
                    className="flex-1 text-center rounded-md border px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    View
                  </Link>
                  <button
                    className="flex-1 rounded-md bg-zinc-900 text-white px-3 py-1.5 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                    onClick={() => window.open('mailto:sales@propnexus.ai')}
                  >
                    Enquire
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}