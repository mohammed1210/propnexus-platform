'use client';

import { useMemo } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiShield, FiTrendingUp } from 'react-icons/fi';
import {
  computeDealLabel,
  formatMoney,
  formatPct,
  getDealLabelLegalCopy,
  type DealLabelTone,
} from '@/lib/dealLabel';
import DealLabelExplainer from './DealLabelExplainer';

type Props = {
  property: Record<string, any>;
  className?: string;
};

function toneClasses(tone: DealLabelTone): string {
  if (tone === 'emerald') return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-400/10 dark:text-emerald-100';
  if (tone === 'blue') return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-300/25 dark:bg-blue-400/10 dark:text-blue-100';
  if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-100';
  if (tone === 'rose') return 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-300/25 dark:bg-rose-400/10 dark:text-rose-100';
  return 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100';
}

function barClass(tone: DealLabelTone): string {
  if (tone === 'emerald') return 'from-emerald-400 to-lime-300';
  if (tone === 'blue') return 'from-blue-400 to-cyan-300';
  if (tone === 'amber') return 'from-amber-400 to-orange-300';
  if (tone === 'rose') return 'from-rose-400 to-red-300';
  return 'from-slate-300 to-slate-500';
}

export default function DealLabelPanel({ property, className = '' }: Props) {
  const dealLabel = useMemo(() => computeDealLabel(property), [property]);
  const calculations = dealLabel.calculations;

  const workedOut = [
    `Price position: ${dealLabel.pricePositionLabel}`,
    `Rent evidence: ${calculations.rentEvidence === 'direct' ? 'direct property evidence' : calculations.rentEvidence === 'derived' ? 'derived evidence' : 'missing'}`,
    `Comparable sales: ${calculations.soldBenchmark ? formatMoney(calculations.soldBenchmark) : 'not available'}${calculations.compsCount !== null ? ` from ${calculations.compsCount} comps` : ''}`,
    `Listing signals: ${calculations.positiveListingSignals.length ? calculations.positiveListingSignals.join(', ') : 'none found'}`,
  ];

  return (
    <section className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40 ${className}`} data-testid="deal-label-panel">
      <div className="border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-brand-50/50 p-5 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-brand-950/20 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-brand-700 dark:text-brand-200">
                <FiShield className="h-4 w-4" aria-hidden="true" />
                Investor Deal Label
              </div>
              <DealLabelExplainer />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-black ${toneClasses(dealLabel.tone)}`}>
                {dealLabel.label}
              </span>
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Score {dealLabel.score}/100</span>
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Confidence {dealLabel.confidence}/100</span>
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              {dealLabel.pricePositionLabel}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {dealLabel.summary}
            </p>
          </div>
          <div className="grid min-w-[220px] grid-cols-2 gap-2 rounded-2xl border border-white/70 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/50">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Score</div>
              <div className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{dealLabel.score}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Confidence</div>
              <div className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{dealLabel.confidence}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/30">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Asking price</div>
            <div className="mt-1 text-lg font-black text-slate-950 dark:text-white">{formatMoney(calculations.askingPrice)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/30">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Sold benchmark</div>
            <div className="mt-1 text-lg font-black text-slate-950 dark:text-white">{formatMoney(calculations.soldBenchmark)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/30">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Gross yield</div>
            <div className="mt-1 text-lg font-black text-slate-950 dark:text-white">{formatPct(calculations.grossYieldPct)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/30">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Monthly rent</div>
            <div className="mt-1 text-lg font-black text-slate-950 dark:text-white">{formatMoney(calculations.monthlyRent)}</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
              <FiCheckCircle className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              Why this label?
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {dealLabel.strongestSignals.map((signal) => (
                <li key={signal} className="leading-relaxed">{signal}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
              <FiAlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
              Main checks before offer
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {dealLabel.mainRisks.map((risk) => (
                <li key={risk} className="leading-relaxed">{risk}</li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
            <FiTrendingUp className="h-4 w-4 text-brand-500" aria-hidden="true" />
            How we worked it out
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {workedOut.map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-black text-slate-950 dark:text-white">Signal breakdown</div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {dealLabel.signals.map((signal) => {
              const width = Math.max(0, Math.min(100, (signal.points / signal.max) * 100));
              return (
                <div key={signal.key} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-950 dark:text-white">{signal.label}</div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{signal.detail}</p>
                    </div>
                    <div className="shrink-0 text-sm font-black text-slate-800 dark:text-slate-100">{signal.points}/{signal.max}</div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" aria-hidden="true">
                    <div className={`h-full rounded-full bg-gradient-to-r ${barClass(signal.tone)}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-100">
          {getDealLabelLegalCopy()}
        </p>
      </div>
    </section>
  );
}
