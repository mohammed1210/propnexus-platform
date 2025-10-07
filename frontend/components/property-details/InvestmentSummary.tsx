'use client';
import { useEffect, useState } from 'react';

type SummaryData = {
  ok?: boolean;
  summary?: string;
  rationale?: string[];
};

type Props = {
  /** Prefer passing the property id as `id` */
  id?: string;
  /** Accept alternative prop names so we don't break existing callers */
  propertyId?: string;
  property?: { id?: string };
  data?: { id?: string };
  /** User tier for rate caps (optional) */
  userTier?: string;
};

export default function InvestmentSummary(props: Props) {
  const propertyId =
    props.id ??
    props.propertyId ??
    props.property?.id ??
    props.data?.id ??
    '';

  const userTier = props.userTier ?? 'free';

  const [data, setData] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // Only call the backend if we have an id and API base
    const apiBase = process.env.NEXT_PUBLIC_API_BASE;
    if (!propertyId || !apiBase) return;

    setLoading(true);
    fetch(`${apiBase}/gpt/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: propertyId, user_tier: userTier }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Bad response ${r.status}`);
        return r.json();
      })
      .then((json) => setData(json as SummaryData))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [propertyId, userTier]);

  if (!propertyId) {
    return (
      <div className="text-sm text-zinc-500">
        No property selected.
      </div>
    );
  }

  if (loading) {
    return <div className="text-sm text-zinc-500">Generating summary…</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">Error: {error}</div>;
  }

  if (!data || !data.summary) {
    return <div className="text-sm text-zinc-500">No summary yet.</div>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm leading-6">{data.summary}</p>
      {!!data.rationale?.length && (
        <ul className="list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-300">
          {data.rationale.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
