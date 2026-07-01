'use client';

import UpgradeButton from '@/components/UpgradeButton';
import { getCheckoutConfigForPlan } from '@/lib/pricingPlans';
import { getEntitlements } from '@/lib/entitlements';
import { useUserPlan } from '@/lib/useUserPlan';
import type { InvestorIntel } from '@/types/investorIntel';

export function fmtGBP(n: unknown): string {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
}

function fmtPct(n: unknown): string {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : '—';
}

export default function OfferIntelligence({ intel, loading = false }: { intel: InvestorIntel | null; loading?: boolean }) {
  const { plan } = useUserPlan();
  const entitlements = getEntitlements(plan);
  const hasVerifiedRentEvidence = Boolean(intel?.rent_evidence?.is_real_rent_evidence);
  const rawConclusion = typeof intel?.conclusion === 'string' ? intel.conclusion.trim() : '';
  const conclusionText =
    !hasVerifiedRentEvidence && /insufficient rent evidence/i.test(rawConclusion)
      ? 'Add verified rent evidence to unlock a reliable target offer and walk-away price.'
      : rawConclusion;
  const targetPriceMap = intel?.offer_intelligence?.target_purchase_price_from_rent ?? null;
  const availableTargetPrices = ['6', '7', '8']
    .map((key) => Number(targetPriceMap?.[key as keyof typeof targetPriceMap]))
    .filter((value) => Number.isFinite(value) && value > 0);
  const indicativeLow = availableTargetPrices.length ? Math.min(...availableTargetPrices) : null;
  const indicativeHigh = availableTargetPrices.length ? Math.max(...availableTargetPrices) : null;
  const starterCheckout = getCheckoutConfigForPlan('investor_starter');
  const proCheckout = getCheckoutConfigForPlan('investor_pro');

  const offerRangeSection = entitlements.hasFullOfferRange ? (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <h4 className="font-black text-slate-950 dark:text-white">Rent required at asking price</h4>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          {['6', '7', '8'].map((t) => (
            <div key={t} className="rounded-xl bg-white p-3 dark:bg-slate-950/50">
              <div className="text-xs text-slate-500">{t}% yield</div>
              <div className="font-bold">{fmtGBP(intel?.offer_intelligence?.rent_required_at_asking?.[t])}/mo</div>
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
              <div className="font-bold">{fmtGBP(intel?.offer_intelligence?.target_purchase_price_from_rent?.[t])}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : entitlements.hasBasicOfferRange ? (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/80 p-4 dark:border-brand-900/60 dark:bg-brand-950/20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-200">Starter offer range</div>
          <h4 className="mt-1 text-lg font-black text-slate-950 dark:text-white">Indicative range from evidenced rent</h4>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            {hasVerifiedRentEvidence && indicativeLow !== null && indicativeHigh !== null
              ? `${fmtGBP(indicativeLow)} to ${fmtGBP(indicativeHigh)} gives you a first-pass buy box before you underwrite finance and walk-away discipline.`
              : 'Rent evidence is still too weak for a reliable indicative range. Add verified rent or comparable evidence before relying on target pricing.'}
          </p>
        </div>
        <div className="min-w-[14rem]">
          <UpgradeButton priceId={proCheckout.priceId} productId={proCheckout.productId} className="btn-primary w-full justify-center">
            Unlock Investor Pro
          </UpgradeButton>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
        Investor Pro adds target offer, max offer, walk-away pricing and PDF-ready Deal Pack export.
      </p>
    </div>
  ) : (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Offer range preview</div>
          <h4 className="mt-1 text-lg font-black text-slate-950 dark:text-white">Upgrade to see what price makes the deal work</h4>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            Free users can review the evidence snapshot and yield context. Investor Starter unlocks an indicative offer range when the rent evidence is strong enough.
          </p>
        </div>
        <div className="min-w-[14rem]">
          <UpgradeButton priceId={starterCheckout.priceId} productId={starterCheckout.productId} className="btn-primary w-full justify-center">
            Unlock Investor Starter
          </UpgradeButton>
        </div>
      </div>
    </div>
  );

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

      {offerRangeSection}

      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm dark:border-brand-900/60 dark:bg-brand-950/20">
        <div className="font-black text-brand-900 dark:text-brand-100">Conclusion</div>
        <p className="mt-1 text-brand-800 dark:text-brand-200">{conclusionText}</p>
        {!hasVerifiedRentEvidence ? (
          <p className="mt-2 text-brand-700 dark:text-brand-200/90">
            Manual deal records can still be analysed, but target offer calculations are withheld until rent/comparable evidence is available.
          </p>
        ) : null}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        Comparable median: {fmtGBP(intel.sold_comp_benchmark?.median_similar_price)} · Difference: {fmtGBP(Math.abs(Number(intel.sold_comp_benchmark?.subject_vs_median_amount || 0)))} ({fmtPct(intel.sold_comp_benchmark?.subject_vs_median_pct)}) · {intel.sold_comp_benchmark?.benchmark_confidence || 'weak'} comp set
      </div>
    </div>
  );

  return body;
}
