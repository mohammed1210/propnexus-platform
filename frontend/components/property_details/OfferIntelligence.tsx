'use client';

import { useEffect, useState } from 'react';
import GatedPanel from '@/components/property_details/GatedPanel';

type Intel = {
  asking_price?: number | null;
  current_monthly_rent?: number | null;
  gross_yield_percent?: number | null;
  rent_evidence?: { source?: string; quality?: string; is_real_rent_evidence?: boolean; monthly_rent?: number | null };
  sold_comp_benchmark?: { median_similar_price?: number | null; benchmark_confidence?: string; subject_vs_median_amount?: number | null; subject_vs_median_pct?: number | null; similar_sales_count?: number | null; range_low?: number | null; range_high?: number | null };
  offer_intelligence?: { rent_required_at_asking?: Record<string, number | null>; target_purchase_price_from_rent?: Record<string, number | null>; price_gap_to_7pct_yield?: number | null };
  conclusion?: string;
};

export function fmtGBP(n: unknown): string {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
}

function fmtPct(n: unknown): string {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : '—';
}

export default function OfferIntelligence({ propertyId }: { propertyId: string }) {
  const [intel, setIntel] = useState<Intel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/investor-intel`, { cache: 'no-store' });
        const json = res.ok ? await res.json() : null;
        if (!cancelled) setIntel(json);
      } catch {
        if (!cancelled) setIntel(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const body = loading ? (
    <div className="animate-pulse space-y-3">
      <div className="h-20 rounded-2xl bg-slate-200 dark:bg-slate-800" />
      <div className="h-20 rounded-2xl bg-slate-200 dark:bg-slate-800" />
    </div>
  ) : !intel ? (
    <p className="text-sm text-slate-600 dark:text-slate-300">Offer Intelligence is unavailable for this listing.</p>
  ) : (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Current asking</div>
          <div className="mt-1 text-2xl font-black">{fmtGBP(intel.asking_price)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Rent evidence</div>
          <div className="mt-1 text-2xl font-black">{fmtGBP(intel.current_monthly_rent)}/mo</div>
          <p className="mt-1 text-xs text-slate-500">{intel.rent_evidence?.is_real_rent_evidence ? intel.rent_evidence?.source : 'Estimate/missing — not treated as a rent comp'}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Evidenced gross yield</div>
          <div className="mt-1 text-2xl font-black">{intel.gross_yield_percent ? `${intel.gross_yield_percent}%` : '—'}</div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <h4 className="font-black text-slate-950 dark:text-white">Rent required at asking price</h4>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            {['6', '7', '8'].map((t) => (
              <div key={t} className="rounded-xl bg-white p-3 dark:bg-slate-950/50">
                <div className="text-xs text-slate-500">{t}% yield</div>
                <div className="font-bold">{fmtGBP(intel.offer_intelligence?.rent_required_at_asking?.[t])}/mo</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <h4 className="font-black text-slate-950 dark:text-white">Target price from evidenced rent</h4>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            {['6', '7', '8'].map((t) => (
              <div key={t} className="rounded-xl bg-white p-3 dark:bg-slate-950/50">
                <div className="text-xs text-slate-500">{t}% yield</div>
                <div className="font-bold">{fmtGBP(intel.offer_intelligence?.target_purchase_price_from_rent?.[t])}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm dark:border-brand-900/60 dark:bg-brand-950/20">
        <div className="font-black text-brand-900 dark:text-brand-100">Conclusion</div>
        <p className="mt-1 text-brand-800 dark:text-brand-200">{intel.conclusion}</p>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        Comparable median: {fmtGBP(intel.sold_comp_benchmark?.median_similar_price)} · Difference: {fmtGBP(Math.abs(Number(intel.sold_comp_benchmark?.subject_vs_median_amount || 0)))} ({fmtPct(intel.sold_comp_benchmark?.subject_vs_median_pct)}) · {intel.sold_comp_benchmark?.benchmark_confidence || 'weak'} comp set
      </div>
    </div>
  );

  return (
    <GatedPanel title="Offer Intelligence" requiredPlan="investor" featureEnabled={true} showPreviewWhenLocked>
      {body}
    </GatedPanel>
  );
}
