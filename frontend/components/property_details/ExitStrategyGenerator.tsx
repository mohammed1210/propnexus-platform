'use client';

import React, { useState } from 'react';
import { postAiStrategies } from '@/lib/api';
import type { StrategiesRequest, StrategiesResponse, Strategy } from '@/types/ai';

type Props = {
  title: string;
  location: string;
  price?: number;
  yield_percent?: number;
  roi_percent?: number;
  propertyType?: string;
  investmentType?: string;
  description?: string;
};

export default function ExitStrategyGenerator(props: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<Strategy[] | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      // NOTE: constraints is optional — omit when empty to satisfy the type
      const payload: StrategiesRequest = {
        property: {
          title: props.title,
          location: props.location,
          price: props.price,
          yield_percent: props.yield_percent,
          roi_percent: props.roi_percent,
          propertyType: props.propertyType,
          investmentType: props.investmentType,
          description: props.description,
        },
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
