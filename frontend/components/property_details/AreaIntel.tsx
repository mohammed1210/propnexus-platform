import React from 'react';
import { Property } from '@/types';

type Props = { property: Property };

export default function AreaIntel({ property }: Props) {
  // Temporary/dummy values until live feed is wired
  const intel = {
    yield: '5.2%',
    crime: 'Low vs national',
    transport: 'Excellent · ~18 mins to centre',
    schools: 'Ofsted Good',
  };

  // try to pull postcode-ish tail for the callout
  const areaTag =
    (property?.location || '')
      .split(' ')
      .slice(-2)
      .join(' ')
      .replace(/[,\.]+$/, '') || 'Local area';

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
        📍 Area Intelligence
      </h2>

      <p className="text-sm text-slate-600 mb-4">
        A quick snapshot of rental demand and liveability around{" "}
        <span className="font-semibold">{areaTag}</span>.
      </p>

      <ul className="divide-y divide-slate-200 dark:divide-slate-700 rounded-md border">
        <li className="p-3 flex items-start gap-3">
          <span className="text-lg">💷</span>
          <div className="flex-1">
            <p className="font-medium">Avg. rental yield</p>
            <p className="text-slate-600">{intel.yield}</p>
            <p className="text-xs text-slate-500 mt-1">
              Useful for quick rent‑vs‑price sense‑check.
            </p>
          </div>
        </li>

        <li className="p-3 flex items-start gap-3">
          <span className="text-lg">🔒</span>
          <div className="flex-1">
            <p className="font-medium">Crime rate</p>
            <p className="text-slate-600">{intel.crime}</p>
            <p className="text-xs text-slate-500 mt-1">
              Lower crime can support stronger tenant demand and lower void risk.
            </p>
          </div>
        </li>

        <li className="p-3 flex items-start gap-3">
          <span className="text-lg">🚆</span>
          <div className="flex-1">
            <p className="font-medium">Transport</p>
            <p className="text-slate-600">{intel.transport}</p>
            <p className="text-xs text-slate-500 mt-1">
              Good links typically increase rental pool and reduce time‑to‑let.
            </p>
          </div>
        </li>

        <li className="p-3 flex items-start gap-3">
          <span className="text-lg">🏫</span>
          <div className="flex-1">
            <p className="font-medium">Schools</p>
            <p className="text-slate-600">{intel.schools}</p>
            <p className="text-xs text-slate-500 mt-1">
              Strong schools often support family demand and longer tenancies.
            </p>
          </div>
        </li>
      </ul>

      <p className="text-[11px] text-slate-500 mt-3">
        Figures are illustrative for product design. Live data sources coming soon (ONS, Police,
        Ofsted, TfL/National Rail).
      </p>
    </div>
  );
}
