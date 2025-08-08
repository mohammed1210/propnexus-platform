// /frontend/components/property_details/AreaIntel.tsx
import React from 'react';
import { Property } from '@/types';

type Props = { property: Property };

export default function AreaIntel({ property }: Props) {
  // Light parsing to surface postcode (purely cosmetic)
  const postcode =
    (property?.location || '').match(/\b[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}\b/i)?.[0] ??
    '';

  // Placeholder intel (replace with live data later)
  const intel = {
    yield: '5.2%',
    crime: 'Low vs national',
    transport: 'Excellent · ~18 mins to centre',
    schools: 'Ofsted Good',
  };

  return (
    <div>
      <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center text-rose-500"
        >
          📍
        </span>
        Area Intelligence
      </h2>

      <p className="text-sm text-slate-600 mb-4">
        A quick snapshot of rental demand and liveability around{' '}
        <strong>{postcode || property.location || 'this area'}</strong>.
      </p>

      {/* grid for clean alignment, icons sized uniformly */}
      <ul className="grid grid-cols-1 gap-4">
        <li className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 inline-flex h-5 w-5 items-center justify-center">
            📈
          </span>
          <div>
            <p className="font-medium">Avg. rental yield</p>
            <p className="text-slate-700">{intel.yield}</p>
            <p className="text-xs text-slate-500 mt-1">
              Useful for a quick rent‑vs‑price sense check.
            </p>
          </div>
        </li>

        <li className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 inline-flex h-5 w-5 items-center justify-center">
            🛡️
          </span>
          <div>
            <p className="font-medium">Crime rate</p>
            <p className="text-slate-700">{intel.crime}</p>
            <p className="text-xs text-slate-500 mt-1">
              Lower crime can support stronger tenant demand and lower void risk.
            </p>
          </div>
        </li>

        <li className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 inline-flex h-5 w-5 items-center justify-center">
            🚌
          </span>
          <div>
            <p className="font-medium">Transport</p>
            <p className="text-slate-700">{intel.transport}</p>
            <p className="text-xs text-slate-500 mt-1">
              Good links typically increase the rental pool and reduce time‑to‑let.
            </p>
          </div>
        </li>

        <li className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 inline-flex h-5 w-5 items-center justify-center">
            🏫
          </span>
          <div>
            <p className="font-medium">Schools</p>
            <p className="text-slate-700">{intel.schools}</p>
            <p className="text-xs text-slate-500 mt-1">
              Strong schools often support family demand and longer tenancies.
            </p>
          </div>
        </li>
      </ul>

      <p className="text-xs text-slate-500 mt-4">
        Figures are illustrative for product design. Live data sources coming soon (ONS,
        Police, Ofsted, TfL/National Rail).
      </p>
    </div>
  );
}
