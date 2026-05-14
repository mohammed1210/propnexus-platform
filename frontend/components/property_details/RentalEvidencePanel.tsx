'use client';

import { fmtGBP } from '@/components/property_details/OfferIntelligence';
import type { InvestorIntel, RentComp } from '@/types/investorIntel';

function badge(confidence?: string | null) {
  if (confidence === 'strong') return 'Strong evidence';
  if (confidence === 'moderate') return 'Moderate evidence';
  if (confidence === 'limited') return 'Limited evidence';
  return 'Evidence unavailable';
}

function sourceLabel(value?: string | null) {
  if (!value) return 'Rental listing evidence';
  if (value === 'internal_property_listings') return 'Internal rental listing';
  return value.replace(/_/g, ' ');
}

function compTitle(comp: RentComp) {
  return comp.title || comp.short_address || comp.location || comp.postcode || 'Rental comparable';
}

export default function RentalEvidencePanel({ intel }: { intel: InvestorIntel | null }) {
  const rentEvidence = intel?.rent_evidence;
  const comps = Array.isArray(intel?.rent_comps) ? intel.rent_comps : [];
  const isRealEvidence = Boolean(rentEvidence?.is_real_rent_evidence);
  const isEstimateOnly = rentEvidence?.source === 'derived_internal_estimate' || rentEvidence?.quality === 'estimate_only';

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/40 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Rental evidence</div>
          <h3 className="mt-1 text-lg font-black text-slate-950 dark:text-white">Income evidence for offer pricing</h3>
        </div>
        <span className="w-fit rounded-full border border-slate-200 px-3 py-1 text-xs font-bold dark:border-slate-700">
          {badge(intel?.rent_comp_confidence || rentEvidence?.quality)}
        </span>
      </div>

      {isRealEvidence ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50">
              <div className="text-xs text-slate-500">Observed / median rent</div>
              <div className="font-black">{fmtGBP(intel?.rent_comp_median || intel?.current_monthly_rent)}/mo</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50">
              <div className="text-xs text-slate-500">Range</div>
              <div className="font-black">{fmtGBP(intel?.rent_comp_range_low)}-{fmtGBP(intel?.rent_comp_range_high)}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50">
              <div className="text-xs text-slate-500">Evidence count</div>
              <div className="font-black">{intel?.rent_comp_count ?? comps.length}</div>
            </div>
          </div>

          {comps.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {comps.slice(0, 6).map((comp, idx) => (
                <article key={`${comp.source_url || compTitle(comp)}-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="font-bold text-slate-950 dark:text-white">{compTitle(comp)}</div>
                  <div className="mt-1 text-lg font-black text-slate-950 dark:text-white">{fmtGBP(comp.rent_monthly)}/mo</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {[comp.bedrooms ? `${comp.bedrooms} beds` : null, comp.property_type, comp.postcode || comp.location].filter(Boolean).join(' · ')}
                  </div>
                  <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{sourceLabel(comp.source)}</div>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
              A real rent value is available, but no comparable rental listing set is currently attached.
            </p>
          )}
        </div>
      ) : isEstimateOnly ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
          <div className="font-black">Derived rent estimate</div>
          <p className="mt-1">No verified rental comparable set is currently available, so offer pricing remains conservative.</p>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
          <div className="font-black text-slate-900 dark:text-white">Rental evidence unavailable</div>
          <p className="mt-1">Offer targets are intentionally withheld where rent evidence is missing.</p>
        </div>
      )}
    </section>
  );
}
