// /frontend/components/property_details/AreaIntel.tsx
'use client';

import React, { useMemo } from 'react';
import { Property } from '@/types';

type Props = {
  property: Property;
  // optional overrides for when you hook live data later
  overrides?: Partial<{
    avgYieldPct: number;
    crimeLevel: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
    transport: 'Poor' | 'Fair' | 'Good' | 'Very Good' | 'Excellent';
    schools: 'Ofsted Poor' | 'Ofsted Requires Improvement' | 'Ofsted Good' | 'Ofsted Outstanding';
    timeToCityMins: number;
  }>;
};

// tiny helpers for pill colours
const pillClass = (tone: 'green' | 'amber' | 'red' | 'slate') =>
  ({
    green:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    amber:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    red:
      'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    slate:
      'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  }[tone]);

const toneForCrime = (c: string) => {
  if (/very\s*low/i.test(c)) return pillClass('green');
  if (/low/i.test(c)) return pillClass('green');
  if (/medium|moderate/i.test(c)) return pillClass('amber');
  return pillClass('red');
};

const toneForGood = (s: string) => {
  if (/excellent|outstanding/i.test(s)) return pillClass('green');
  if (/good/i.test(s)) return pillClass('green');
  if (/fair|requires improvement/i.test(s)) return pillClass('amber');
  return pillClass('red');
};

export default function AreaIntel({ property, overrides }: Props) {
  // Dummy defaults (replace with live later)
  const base = {
    avgYieldPct: 5.2,
    crimeLevel: 'Low',
    transport: 'Excellent',
    schools: 'Ofsted Good',
    timeToCityMins: 18,
  };

  const intel = { ...base, ...(overrides ?? {}) };

  // grab a friendly place label from the property
  const place = useMemo(() => {
    const loc = property?.location ?? '';
    if (!loc) return 'this area';
    // Try to pick the last meaningful part (e.g., "Birmingham")
    const bits = loc.split(',').map((s) => s.trim()).filter(Boolean);
    return bits[bits.length - 1] || loc;
  }, [property?.location]);

  return (
    <section aria-labelledby="area-intel-heading">
      <h2 id="area-intel-heading" className="text-lg font-semibold mb-3">
        📍 Area Intelligence
      </h2>

      {/* quick “at a glance” line */}
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
        A quick snapshot of rental demand and local liveability around <strong>{place}</strong>.
      </p>

      {/* stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Yield */}
        <div className="rounded-md border border-[var(--border)] p-3 bg-[var(--card-bg)]">
          <div className="text-xs text-slate-500 mb-1">Avg. rental yield</div>
          <div className="flex items-baseline gap-2">
            <div className="text-xl font-semibold">{intel.avgYieldPct.toFixed(1)}%</div>
            <span className={`text-xs px-2 py-[2px] rounded-full ${pillClass('slate')}`}>
              Area avg
            </span>
          </div>
          <div className="mt-2 h-2 w-full rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
            {/* simple bar that caps at 10% for display */}
            <div
              className="h-full bg-emerald-500 dark:bg-emerald-400"
              style={{ width: `${Math.min(100, (intel.avgYieldPct / 10) * 100)}%` }}
            />
          </div>
        </div>

        {/* Crime */}
        <div className="rounded-md border border-[var(--border)] p-3 bg-[var(--card-bg)]">
          <div className="text-xs text-slate-500 mb-1">Crime rate</div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-[2px] rounded-full ${toneForCrime(String(intel.crimeLevel))}`}>
              {intel.crimeLevel}
            </span>
            <span className="text-xs text-slate-500">vs national</span>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Lower crime can support stronger tenant demand and lower void risk.
          </p>
        </div>

        {/* Transport */}
        <div className="rounded-md border border-[var(--border)] p-3 bg-[var(--card-bg)]">
          <div className="text-xs text-slate-500 mb-1">Transport</div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-[2px] rounded-full ${toneForGood(String(intel.transport))}`}>
              {intel.transport}
            </span>
            <span className="text-xs text-slate-500">
              ~{intel.timeToCityMins} mins to centre
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Good links typically increase rental pool and reduce time‑to‑let.
          </p>
        </div>

        {/* Schools */}
        <div className="rounded-md border border-[var(--border)] p-3 bg-[var(--card-bg)]">
          <div className="text-xs text-slate-500 mb-1">Schools</div>
          <span className={`text-xs px-2 py-[2px] rounded-full ${toneForGood(String(intel.schools))}`}>
            {intel.schools}
          </span>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Strong schools often support family demand and longer tenancies.
          </p>
        </div>
      </div>

      {/* footer note */}
      <p className="mt-4 text-xs text-slate-500">
        Figures are illustrative for product design. Live data coming soon (ONS, Police, Ofsted, TfL/National Rail).
      </p>
    </section>
  );
}
