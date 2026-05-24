'use client';

import { useMemo } from 'react';
import { FiShield, FiTrendingUp } from 'react-icons/fi';
import { computeDealLabel, type DealLabelTone } from '@/lib/dealLabel';
import DealLabelExplainer from './DealLabelExplainer';

type Props = {
  property: Record<string, any>;
  className?: string;
};

function toneClasses(tone: DealLabelTone): string {
  if (tone === 'emerald') return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-300/25 dark:bg-emerald-400/10 dark:text-emerald-100';
  if (tone === 'blue') return 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-300/25 dark:bg-blue-400/10 dark:text-blue-100';
  if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-100';
  if (tone === 'rose') return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-300/25 dark:bg-rose-400/10 dark:text-rose-100';
  return 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100';
}

export default function DealLabelChip({ property, className = '' }: Props) {
  const dealLabel = useMemo(() => computeDealLabel(property), [property]);

  return (
    <div className={`rounded-2xl border px-3 py-2 shadow-sm ${toneClasses(dealLabel.tone)} ${className}`} data-testid="deal-label-chip">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] opacity-80">
            <FiShield className="h-3 w-3" aria-hidden="true" />
            Investor Deal Label
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-black leading-none">{dealLabel.label}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black text-slate-800 dark:bg-slate-950/40 dark:text-white">
              <FiTrendingUp className="h-3 w-3" aria-hidden="true" />
              {dealLabel.score}/100
            </span>
          </div>
          <p className="mt-1 text-[11px] font-semibold leading-snug opacity-85">{dealLabel.shortReason}</p>
        </div>
        <DealLabelExplainer compact />
      </div>
    </div>
  );
}
