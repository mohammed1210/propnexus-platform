'use client';

import { fmtGBP } from '@/components/property_details/OfferIntelligence';
import InfoDisclaimer from '@/components/legal/InfoDisclaimer';
import { COMPS_DISCLAIMER } from '@/lib/legalCopy';

type Benchmark = {
  similar_sales_count?: number | null;
  median_similar_price?: number | null;
  range_low?: number | null;
  range_high?: number | null;
  benchmark_confidence?: string | null;
  subject_vs_median_amount?: number | null;
  subject_vs_median_pct?: number | null;
};

export default function ComparableEvidencePanel({ benchmark }: { benchmark?: Benchmark | null }) {
  if (!benchmark) return null;
  const confidence = benchmark.benchmark_confidence || 'weak';
  const badge = confidence === 'strong' ? 'Strong comp set' : confidence === 'limited' ? 'Limited comp set' : 'Weak comparability / use caution';
  const diff = benchmark.subject_vs_median_pct;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/40 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Comparable evidence</div>
          <h3 className="mt-1 text-lg font-black text-slate-950 dark:text-white">Similar sold comp benchmark</h3>
        </div>
        <span className="w-fit rounded-full border border-slate-200 px-3 py-1 text-xs font-bold dark:border-slate-700">{badge}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50"><div className="text-xs text-slate-500">Median</div><div className="font-bold">{fmtGBP(benchmark.median_similar_price)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50"><div className="text-xs text-slate-500">Range</div><div className="font-bold">{fmtGBP(benchmark.range_low)}–{fmtGBP(benchmark.range_high)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50"><div className="text-xs text-slate-500">Comps used</div><div className="font-bold">{benchmark.similar_sales_count ?? 0}</div></div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50"><div className="text-xs text-slate-500">Subject vs median</div><div className="font-bold">{typeof diff === 'number' ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : '—'}</div></div>
      </div>
      <InfoDisclaimer className="mt-4" label="Comparable evidence disclaimer">
        {COMPS_DISCLAIMER} Check property type, size, tenure, condition, distance and sale date before relying on it.
      </InfoDisclaimer>
    </div>
  );
}
