'use client';

import React, { useMemo, useState } from 'react';
import { postAiStrategies } from '@/lib/api';
import type { StrategiesRequest, StrategiesResponse, Strategy } from '@/types/ai';

type Props = {
  title?: string;
  location?: string;
  price?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  propertyType?: string | null;
  investmentType?: string | null;
  description?: string | null;
};

export default function ExitStrategyGenerator(props: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<Strategy[] | null>(null);

  // Guard a non-empty title so backend validation never 422s
  const safeTitle = useMemo(
    () =>
      (props.title ?? '').toString().trim() ||
      `${props.propertyType ?? 'Property'} in ${props.location ?? 'UK'}`,
    [props.title, props.propertyType, props.location],
  );

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const payload: StrategiesRequest = {
        property: {
          title: safeTitle,
          location: props.location ?? '',
          price: typeof props.price === 'number' ? props.price : undefined,
          yield_percent: typeof props.yield_percent === 'number' ? props.yield_percent : undefined,
          roi_percent: typeof props.roi_percent === 'number' ? props.roi_percent : undefined,
          propertyType: props.propertyType ?? undefined,
          investmentType: props.investmentType ?? undefined,
          description: props.description ?? undefined,
        },
        // Add constraints here if you have UI for them. Keep optional.
        // constraints: { budget: 200000, risk_tolerance: 'medium' },
      };

      const res: StrategiesResponse = await postAiStrategies(payload);
      setStrategies(res?.strategies ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to generate strategies');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Generate exit strategies'}
      </button>

      {error && (
        <p role="alert" className="text-red-600 text-sm">
          Error: {error}
        </p>
      )}

      {strategies?.slice(0, 4).map((s, i) => (
        <article key={i} aria-label={`strategy-${i + 1}`} className="rounded-lg border p-4">
          <h4 className="font-semibold">{s.title}</h4>
          {s.rationale && <p className="mt-1 text-sm text-neutral-700">{s.rationale}</p>}

          {Array.isArray(s.steps) && s.steps.length > 0 && (
            <ol className="mt-2 list-decimal pl-5 text-sm space-y-1">
              {s.steps.map((st: string, idx: number) => (
                <li key={idx}>{st}</li>
              ))}
            </ol>
          )}

          {s.risk && (
            <p className="mt-2 text-sm">
              <strong>Risk:</strong> {s.risk}
            </p>
          )}

          <div className="mt-3">
            <button
              className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
              onClick={() => {
                const text =
                  `${s.title}\n\n${s.rationale ?? ''}\n\n` +
                  (s.steps?.length
                    ? `Steps:\n${s.steps.map((x, n) => `${n + 1}. ${x}`).join('\n')}\n\n`
                    : '') +
                  `Risk: ${s.risk ?? ''}`;
                if (navigator?.clipboard) {
                  navigator.clipboard.writeText(text);
                }
              }}
            >
              Copy
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
