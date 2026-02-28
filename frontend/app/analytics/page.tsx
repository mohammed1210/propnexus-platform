'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import PlanGate from '@/components/PlanGate';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { getSupabase } from '@/lib/supabaseClient';
import { formatPercent, getRoiDisplay, getYieldPercent } from '@/lib/normalizeProperty';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type SavedDeal = {
  id: string;
  property_id: string;
  title?: string | null;
  location?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  saved_at?: string | null;
};

export default function AnalyticsPage() {
  const [deals, setDeals] = useState<SavedDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);

      const supabaseConfigured = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      );

      if (!supabaseConfigured) {
        if (!ignore) {
          setDeals([]);
          setLoading(false);
        }
        return;
      }

      try {
        const sb = getSupabase();
        const { data, error } = await sb
          .from('saved_deals')
          .select('*')
          .order('saved_at', { ascending: false });

        if (!ignore) {
          if (error) console.warn('load saved_deals', error);
          setDeals((data as SavedDeal[]) ?? []);
          setLoading(false);
        }
      } catch (e) {
        if (!ignore) {
          console.warn('load saved_deals failed', e);
          setDeals([]);
          setLoading(false);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const kpis = useMemo(() => {
    const count = deals.length;
    const avgYield = avgPercent(deals.map((d) => getYieldPercent(d as any)));
    const avgROI = avgPercent(deals.map((d) => getRoiDisplay(d as any).value));
    const avgRoiIsProxy = deals.some((d) => {
      const roi = getRoiDisplay(d as any);
      return roi.isProxy && roi.value != null;
    });
    const totalValue = deals.reduce((s, d) => s + num(d.price), 0);
    return { count, avgYield, avgROI, avgRoiIsProxy, totalValue };
  }, [deals]);

  const monthly = useMemo(() => {
    const map = new Map<string, { count: number; sumYield: number; yieldCount: number }>();
    for (const d of deals) {
      const key = (d.saved_at ?? '').slice(0, 7) || 'Unknown';
      const m = map.get(key) ?? { count: 0, sumYield: 0, yieldCount: 0 };
      m.count += 1;

      const y = getYieldPercent(d as any);
      if (typeof y === 'number' && Number.isFinite(y)) {
        m.sumYield += y;
        m.yieldCount += 1;
      }
      map.set(key, m);
    }
    const labels = Array.from(map.keys()).sort();
    const countSeries = labels.map((l) => map.get(l)!.count);
    const yieldSeries = labels.map((l) => {
      const m = map.get(l)!;
      if (!m.yieldCount) return 0;
      return round(m.sumYield / m.yieldCount);
    });
    return { labels, countSeries, yieldSeries };
  }, [deals]);

  return (
    <PlanGate require="investor">
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-10 grid grid-cols-1 md:grid-cols-3 gap-6">
      <aside className="md:col-span-1 bg-slate-900 text-white rounded-xl p-4 h-fit">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-500 rounded-md grid place-items-center font-bold">PN</div>
          <div className="font-bold">PropNexus</div>
        </div>
        <nav className="space-y-1">
          <NavItem href="/listings" label="Listings" emoji="🏠" />
          <NavItem href="/analytics" label="Analytics" emoji="📈" active />
          <NavItem href="/saved" label="Saved Deals" emoji="⭐" />
        </nav>
        <div className="mt-6 text-xs text-slate-300">
          Track portfolio metrics, AI scores and market signals here.
        </div>
      </aside>

      <main className="md:col-span-2 space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Analytics &amp; Portfolio</h1>
          <p className="text-slate-600">Aggregated view of your saved deals and signals.</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Saved Deals" value={kpis.count} />
          <KpiCard label="Avg Yield" value={formatPercent(kpis.avgYield)} />
          <KpiCard
            label="Avg ROI"
            value={`${formatPercent(kpis.avgROI)}${kpis.avgRoiIsProxy ? ' (proxy)' : ''}`}
          />
          <KpiCard label="Total Value" value={`£${formatGBP(kpis.totalValue)}`} />
        </div>

        <Section>
          <SectionTitle>Saved Deals Over Time</SectionTitle>
          <div className="rounded-xl border border-slate-200 p-4">
            <Line
              data={{
                labels: monthly.labels,
                datasets: [
                  {
                    label: 'Saved deals',
                    data: monthly.countSeries,
                    borderWidth: 2,
                    tension: 0.3,
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } },
              }}
            />
          </div>
        </Section>

        <Section>
          <SectionTitle>Average Yield by Month</SectionTitle>
          <div className="rounded-xl border border-slate-200 p-4">
            <Line
              data={{
                labels: monthly.labels,
                datasets: [
                  {
                    label: 'Avg yield %',
                    data: monthly.yieldSeries,
                    borderWidth: 2,
                    tension: 0.3,
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, suggestedMax: 12 } },
              }}
            />
          </div>
        </Section>

        <Section>
          <SectionTitle>Recent Saved Deals</SectionTitle>
          <div className="overflow-x-auto overflow-y-auto max-h-[420px] rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <Th>Title</Th>
                  <Th>Location</Th>
                  <Th>Price</Th>
                  <Th>Yield</Th>
                  <Th>ROI</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <Td className="p-3 text-neutral-500" colSpan={6}>
                      Loading…
                    </Td>
                  </tr>
                ) : deals.length === 0 ? (
                  <tr>
                    <Td className="p-3 text-neutral-500" colSpan={6}>
                      No saved deals yet.
                    </Td>
                  </tr>
                ) : (
                  deals
                    .slice(-8)
                    .reverse()
                    .map((d) => (
                      <tr
                        key={d.id}
                        className="border-t border-neutral-200 dark:border-neutral-800"
                      >
                        <Td>{d.title ?? '—'}</Td>
                        <Td>{d.location ?? '—'}</Td>
                        <Td>£{formatGBP(num(d.price))}</Td>
                        <Td>{formatPercent(getYieldPercent(d as any))}</Td>
                        <Td>
                          {(() => {
                            const roi = getRoiDisplay(d as any);
                            const base = formatPercent(roi.value);
                            return `${base}${roi.isProxy ? ' (proxy)' : ''}`;
                          })()}
                        </Td>
                        <Td>{formatDate(d.saved_at)}</Td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </main>
    </div>
    </PlanGate>
  );
}

function NavItem({
  href,
  label,
  emoji,
  active = false,
}: {
  href: string;
  label: string;
  emoji: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-md text-sm ${
        active ? 'bg-white/10' : 'hover:bg-white/10'
      }`}
    >
      <span className="mr-2">{emoji}</span>
      {label}
    </Link>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

type ThProps = React.ThHTMLAttributes<HTMLTableCellElement>;
const Th = ({ className, ...rest }: ThProps) => (
  <th className={`text-left font-medium px-3 py-2 text-slate-600 ${className ?? ''}`} {...rest} />
);

type TdProps = React.TdHTMLAttributes<HTMLTableCellElement>;
const Td = ({ className, ...rest }: TdProps) => (
  <td className={`px-3 py-2 ${className ?? ''}`} {...rest} />
);

/* ---------- helpers ---------- */
function num(n: unknown) {
  return Number(n ?? 0) || 0;
}
function round(n: number) {
  return Number(n.toFixed(2));
}
function avg(list: number[]) {
  const arr = list.filter((x) => Number.isFinite(x));
  return arr.length ? round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
}
function avgPercent(list: Array<number | null>) {
  const arr = list.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return arr.length ? round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
}
function formatGBP(n: number) {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}
function formatDate(s?: string | null) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-GB');
  } catch {
    return '—';
  }
}
