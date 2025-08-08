// /frontend/components/property_details/AreaIntel.tsx
import React from 'react';
import { Property } from '@/types';

type Props = { property: Property };

export default function AreaIntel({ property }: Props) {
  // Cosmetic postcode pull (keeps nice context in the subtitle)
  const areaLabel =
    (property?.location || '').match(/\b[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}\b/i)?.[0] ??
    property.location ??
    'this area';

  // Placeholder intel (swap with live data later)
  const intel = {
    yield: '5.2%',
    crime: 'Low vs national',
    transport: 'Excellent · ~18 mins to centre',
    schools: 'Ofsted Good',
  };

  const items: {
    key: string;
    icon: string;
    label: string;
    value: string;
    hint: string;
  }[] = [
    {
      key: 'yield',
      icon: '📈',
      label: 'Avg. rental yield',
      value: intel.yield,
      hint: 'Quick rent‑vs‑price sense‑check.',
    },
    {
      key: 'crime',
      icon: '🛡️',
      label: 'Crime rate',
      value: intel.crime,
      hint: 'Lower crime can reduce voids and improve tenant demand.',
    },
    {
      key: 'transport',
      icon: '🚌',
      label: 'Transport',
      value: intel.transport,
      hint: 'Good links widen the rental pool and speed time‑to‑let.',
    },
    {
      key: 'schools',
      icon: '🏫',
      label: 'Schools',
      value: intel.schools,
      hint: 'Often supports family demand and longer tenancies.',
    },
  ];

  return (
    <section aria-labelledby="area-intel-title">
      <div className="mb-3">
        <h2 id="area-intel-title" className="text-xl font-semibold flex items-center gap-2">
          <span aria-hidden>📍</span>
          Area Intelligence
        </h2>
        <p className="text-sm text-slate-600">
          Snapshot of rental demand & liveability around <strong>{areaLabel}</strong>.
        </p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((it) => (
          <div
            key={it.key}
            className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-lg"
              >
                {it.icon}
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm text-slate-500">{it.label}</p>
                  {/* Value badge */}
                  <span className="rounded-md border px-2 py-0.5 text-sm font-medium">
                    {it.value}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{it.hint}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Figures are illustrative for product design. Live feeds coming soon (ONS, Police,
        Ofsted, TfL/National Rail).
      </p>
    </section>
  );
}
