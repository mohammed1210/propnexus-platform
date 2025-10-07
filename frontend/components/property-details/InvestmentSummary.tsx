#frontend/components/property-details/InvestmentSummary.tsx#

import { useEffect, useState } from 'react';
import { useEffect, useState } from 'react';
type SummaryData = { ok: boolean; summary?: string; rationale?: string[] };

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
   const [loading, setLoading] = useState<boolean>(false);

   setLoading(true);
   fetch(`${process.env.NEXT_PUBLIC_API_BASE}/gpt/summary`, {
   setLoading(true);
   fetch(`${process.env.NEXT_PUBLIC_API_BASE}/gpt/summary`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ property_id: id, user_tier }),
     })
       .then(async (r) => {
         if (!r.ok) throw new Error(`Bad response ${r.status}`);
         return r.json();
       })
      .then(setData)
      .then((json) => setData(json as SummaryData))
       .catch((e) => setError(e.message))
       .finally(() => setLoading(false));
   }, [id, user_tier]);

  if (loading) return <div className="text-sm text-zinc-500">Generating summary</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;
  if (!data) return <div className="text-sm text-zinc-500">No summary yet.</div>;
  if (loading) return <div className="text-sm text-zinc-500">Generating summary</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;
  if (!data || !data.summary) return <div className="text-sm text-zinc-500">No summary yet.</div>;

  return <p className="text-sm leading-6">{data.summary}</p>;
  return <div className="space-y-2">
    <p className="text-sm leading-6">{data.summary}</p>
    {!!data.rationale?.length && (
      <ul className="list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-300">
        {data.rationale.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    )}
  </div>;
