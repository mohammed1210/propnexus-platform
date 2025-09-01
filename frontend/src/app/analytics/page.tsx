'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import Section from '@/components/ui/Section';
import SectionTitle from '@/components/ui/SectionTitle';
import Badge from '@/components/ui/Badge';

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
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

/** ── Supabase (lazy, browser-only singleton) ───────────────────── */
let _sb: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _sb;
}

/** Types */
type SavedDeal = {
  id: string;
  property_id: string;
  title?: string | null;
  location?: string | null;
  price?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  created_at?: string | null;
};

export default function AnalyticsPage() {
  const [deals, setDeals] = useState<SavedDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabase();
    (async () => {
      setLoading(true);
      const { data } = await sb
        .from('saved_deals')
        .select(
          'id, property_id, title, location, price, yield_percent, roi_percent, created_at'
        )
        .order('created_at', { ascending: true });
      setDeals((data as SavedDeal[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const kpis = useMemo(() => {
    const count = deals.length;
    const avgYield = safeAvg(deals.map((d) => Number(d.yield_percent ?? 0)));
    const avgROI = safeAvg(deals.map((d) => Number(d.roi_percent ?? 0)));
    const totalValue = deals.reduce((s, d) => s + Number(d.price ?? 0), 0);
    return { count, avgYield, avgROI, totalValue };
  }, [deals]);

  const monthly = useMemo(() => {
    const map = new Map<string, { count: number; avgYield: number }>();
    deals.forEach((d) => {
      const key = (d.created_at ?? '').slice(0, 7) || 'Unknown';
      const init = map.get(key) || { count: 0, avgYield: 0 };
      map.set(key, {
        count: init.count + 1,
        avgYield: ((init.avgYield * init.count) + Number(d.yield_percent ?? 0)) / (init.count + 1),
      });
    });
    const labels = Array.from(map.keys()).sort();
    return {
      labels,
      countSeries: labels.map((l) => map.get(l)!.count),
      yieldSeries: labels.map((l) => Number(map.get(l)!.avgYield.toFixed(2))),
    };
  }, [deals]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-10 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Sidebar */}
      <aside className="md:col-span-1 bg-slate-900 text-white rounded-xl p-4 h-fit">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-500 rounded-md grid place-items-center font-bold">
            PN
          </div>
          <div className="font-bold">PropNexus</div>
        </div>

        <nav className="space-y-1">
          <NavItem href="/" label="Listings" emoji="🏠" />
          <NavItem href="/analytics" label="Analytics" emoji="📈" active />
          <NavItem href="/deals" label="Saved Deals" emoji="⭐" />
        </nav>

        <div className="mt-6 text-xs text-slate-300">
          Track portfolio metrics, AI scores and market signals here.
        </div>
      </aside>

      {/* Content */}
      <main className="md:col-span-2 space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Analytics & Portfolio</h1>
          <p className="text-slate-600">Aggregated view of your saved deals and signals.</p>
        </header>

        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Saved Deals" value={kpis.count} />
          <KpiCard label="Avg Yield" value={`${kpis.avgYield}%`} />
          <KpiCard label="Avg ROI" value={`${kpis.avgROI}%`} />
          <KpiCard label="Total Value" value={`£${formatGBP(kpis.totalValue)}`} />
        </div>

        {/* Charts */}
        <Section>
          <SectionTitle icon={<span>📈</span>}>Saved Deals Over Time</SectionTitle>
          <div className="rounded-xl border border-slate-200 p-4">
            <Line
              data={{
                labels: monthly.labels,
                datasets: [
                  { label: 'Saved deals', data: monthly.countSeries, borderWidth: 2, tension: 0.3 },
                ],
              }}
              options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
            />
          </div>
        </Section>

        <Section>
          <SectionTitle icon={<span>📊</span>}>Average Yield by Month</SectionTitle>
          <div className="rounded-xl border border-slate-200 p-4">
            <Line
              data={{
                labels: monthly.labels,
                datasets: [
                  { label: 'Avg yield %', data: monthly.yieldSeries, borderWidth: 2, tension: 0.3 },
                ],
              }}
              options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, suggestedMax: 12 } } }}
            />
          </div>
        </Section>

        {/* Recent saved deals */}
        <Section>
          <SectionTitle icon={<span>⭐</span>}>Recent Saved Deals</SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
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
                    <td className="p-3 text-slate-500" colSpan={6}>
                      Loading…
                    </td>
                  </tr>
                ) : deals.length === 0 ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={6}>
                      No saved deals yet.
                    </td>
                  </tr>
                ) : (
                  deals
                    .slice(-8)
                    .reverse()
                    .map((d) => (
                      <tr key={d.id} className="border-t">
                        <Td>{d.title ?? '—'}</Td>
                        <Td>{d.location ?? '—'}</Td>
                        <Td>£{formatGBP(Number(d.price ?? 0))}</Td>
                        <Td>{d.yield_percent ?? '—'}%</Td>
                        <Td>{d.roi_percent ?? '—'}%</Td>
                        <Td>{formatDate(d.created_at)}</Td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </main>
    </div>
  );
}

/* ─── Little helpers ────────────────────────────────────────────── */
function NavItem({ href, label, emoji, active = false }:{
  href: string; label: string; emoji: string; active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-md text-sm ${active ? 'bg-white/10' : 'hover:bg-white/10'}`}
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
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2 text-slate-600">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}
function safeAvg(nums: number[]) {
  const arr = nums.filter((n) => Number.isFinite(n));
  if (!arr.length) return 0;
  const v = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Number(v.toFixed(2));
}
function formatGBP(n: number) {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString();
}
function formatDate(s?: string | null) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return '—';
  }
}