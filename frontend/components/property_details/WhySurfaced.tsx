type WhySurfacedProperty = {
  top_deal_score?: number | null;
  top_deal_tier?: string | null;
  top_deal_reasons?: string[] | null;
  top_deal?: {
    score?: number | null;
    tier?: string | null;
    reasons?: string[] | null;
    evidence?: Record<string, unknown> | null;
  } | null;
  data?: {
    top_deal?: {
      score?: number | null;
      tier?: string | null;
      reasons?: string[] | null;
      evidence?: Record<string, unknown> | null;
    } | null;
  } | null;
};

function safeReasons(reasons: unknown): string[] {
  if (!Array.isArray(reasons)) return [];
  return reasons
    .filter((reason): reason is string => typeof reason === 'string' && reason.trim().length > 0)
    .filter((reason) => !/\bbmv\b|below market/i.test(reason) || /sold-comps|sold comps|comps median|local sold/i.test(reason))
    .slice(0, 4);
}

export default function WhySurfaced({ property }: { property: WhySurfacedProperty }) {
  const embedded = property.top_deal ?? property.data?.top_deal ?? null;
  const score =
    typeof property.top_deal_score === 'number'
      ? property.top_deal_score
      : typeof embedded?.score === 'number'
        ? embedded.score
        : null;
  const tier = String(property.top_deal_tier || embedded?.tier || '').trim();
  const reasons = safeReasons(property.top_deal_reasons ?? embedded?.reasons);

  if (score === null && !tier && reasons.length === 0) return null;

  return (
    <section className="border-t border-slate-200 bg-amber-50/60 p-5 dark:border-slate-800 dark:bg-amber-400/10 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">
            Why PropNexus surfaced this
          </div>
          <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950 dark:text-white">
            Evidence-backed Top Deal ranking
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-700 dark:text-slate-300">
            This is a scrape-discovery score, separate from the AI Deal Score. It only shows signals found in the listing, search pass, or verified comparable data.
          </p>
        </div>
        <div className="w-fit rounded-2xl border border-amber-200 bg-white px-4 py-2 text-sm font-black text-amber-800 shadow-sm dark:border-amber-300/25 dark:bg-slate-950/60 dark:text-amber-100">
          {score !== null ? `${Math.round(score)}/100` : 'Top Deal'}
          {tier && <span className="ml-2 text-xs font-bold capitalize opacity-75">{tier.replace('_', ' ')}</span>}
        </div>
      </div>

      {reasons.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {reasons.map((reason) => (
            <li key={reason} className="rounded-xl border border-amber-100 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-amber-300/15 dark:bg-slate-950/50 dark:text-slate-200">
              {reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
