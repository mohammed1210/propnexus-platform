'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
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
import PlanGate from '@/components/PlanGate';

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
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const kpis = useMemo(() => {
    const count = deals.length;
    const avgYield = avg(deals.map((d) => num(d.yield_percent)));
    const avgROI = avg(deals.map((d) => num(d.roi_percent)));
    const totalValue = deals.reduce((s, d) => s + num(d.price), 0);
    return { count, avgYield, avgROI, totalValue };
  }, [deals]);

  const monthly = useMemo(() => {
    const map = new Map<string, { count: number; sumYield: number }>();
    for (const d of deals) {
      const key = (d.saved_at ?? '').slice(0, 7) || 'Unknown';
      const m = map.get(key) ?? { count: 0, sumYield: 0 };
      m.count += 1;
      m.sumYield += num(d.yield_percent);
      map.set(key, m);
    }
    const labels = Array.from(map.keys()).sort();
    const countSeries = labels.map((l) => map.get(l)!.count);
    const yieldSeries = labels.map((l) =>
      round(map.get(l)!.sumYield / Math.max(map.get(l)!.count, 1) || 0),
    );
    return { labels, countSeries, yieldSeries };
  }, [deals]);

  return (
    <PlanGate requiredPlan="pro">
      <div className="mx-auto max-w-7xl px-4 py-6 md:py-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <aside className="md:col-span-1 bg-slate-900 text-white rounded-xl p-4 h-fit">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-500 rounded-md grid place-items-center font-bold">PN</div>
          <div className="font-bold">PropNexus</div>
        </div>
        <nav className="space-y-1">
          <NavItem href="/listings" label="Listings" emoji="🏠" />
          <NavItem href="/analytics" label="Analytics" emoji="📈" active />
          <NavItem href="/saved-deals" label="Saved Deals" emoji="⭐" />
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
          <KpiCard label="Avg Yield" value={`${kpis.avgYield}%`} />
          <KpiCard label="Avg ROI" value={`${kpis.avgROI}%`} />
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
                        <Td>{valOrDash(d.yield_percent)}%</Td>
                        <Td>{valOrDash(d.roi_percent)}%</Td>
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
function valOrDash(n?: number | null) {
  return n == null ? '–' : n;
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
