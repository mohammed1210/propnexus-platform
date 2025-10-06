'use client';

import React, { useState } from 'react';
import { postAiStrategies } from '@/lib/api';
import type { StrategiesRequest, StrategiesResponse, Strategy } from '@/types/ai';

type Props = {
  title?: string;
  location?: string;
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
      // Our API expects a property object inside the request
      const payload: StrategiesRequest = {
        property: {
          title: props.title ?? '',
          location: props.location ?? '',
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
        className="btn btn-outline"
      >
        {loading ? 'Generating…' : 'Generate exit strategies'}
      </button>

      {error ? <p className="text-red-600 text-sm">{error}</p> : null}

      {Array.isArray(strategies) && strategies.length > 0 && (
        <ul className="list-disc pl-5 space-y-1">
          {strategies.map((s, i) => (
            <li key={i}>{typeof s === 'string' ? s : s.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
