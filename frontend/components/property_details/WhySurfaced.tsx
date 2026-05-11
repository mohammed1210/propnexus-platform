import { getTopDealDisplay } from '@/lib/topDealCopy';

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

export default function WhySurfaced({ property }: { property: WhySurfacedProperty }) {
  const embedded = property.top_deal ?? property.data?.top_deal ?? null;
  const display = getTopDealDisplay(property as any);
  const score = display?.score ?? null;
  const evidence = embedded?.evidence ?? null;
  const rawSignals = Array.isArray((evidence as any)?.deal_signals) ? (evidence as any).deal_signals : [];
  const listingSignals = rawSignals.length
    ? rawSignals.map((signal: unknown) => String(signal).replace(/_/g, ' ')).slice(0, 4).join(' + ')
    : display?.reasons?.length
      ? display.reasons.map((reason) => reason.label).slice(0, 2).join(' + ')
      : 'No strong listing signals yet';

  const hasSoldComps = Boolean(display?.evidenceFlags.has_sold_comps);
  const hasDiscount = Boolean(display?.evidenceFlags.has_verified_discount);
  const hasRent = Boolean(display?.evidenceFlags.has_verified_rent);
  const hasDataQuality = Boolean((evidence as any)?.has_price && (evidence as any)?.has_source_url);
  const lowScore = score !== null && score < 55;

  if (!display) return null;

  const missing = [
    !hasSoldComps || !hasDiscount ? 'verified discount vs sold comps' : null,
    !hasRent ? 'verified rent' : null,
    !display.positives.some((r) => /value-add|price reduction|auction|below local/i.test(r.label)) ? 'stronger value-add or reduction evidence' : null,
  ].filter(Boolean) as string[];

  const checks = [
    'Ask the agent for reduction history and seller motivation.',
    'Validate rent with live rental comparables.',
    'Compare recent sold comps before offer.',
  ];

  return (
    <section className="border-t border-slate-200 bg-amber-50/60 p-5 dark:border-slate-800 dark:bg-amber-400/10 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">
            {lowScore ? 'Why this is not a top deal yet' : 'Why PropNexus surfaced this'}
          </div>
          <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950 dark:text-white">
            {lowScore ? 'Not enough evidence to call this a strong lead yet' : 'Discovery signal based on listing evidence, comps and data quality'}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-700 dark:text-slate-300">
            {lowScore
              ? 'Some scrape signals were found, but evidence is currently thin. Treat this as a manual-check item, not a top deal.'
              : 'This is the discovery score used to decide whether PropNexus should surface the listing. It is separate from the AI Deal Score used for deeper due diligence.'}
          </p>
        </div>
        <div className="w-fit rounded-2xl border border-amber-200 bg-white px-4 py-2 text-sm font-black text-amber-800 shadow-sm dark:border-amber-300/25 dark:bg-slate-950/60 dark:text-amber-100">
          {lowScore ? 'Low-confidence discovery score' : 'Top Deal Score'} {score !== null ? `${Math.round(score)}/100` : ''}
          <span className="ml-2 text-xs font-bold opacity-75">{display.badge}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-amber-100 bg-white/80 p-3 text-sm dark:border-amber-300/15 dark:bg-slate-950/50">
          <div className="font-bold text-slate-950 dark:text-white">Listing signals</div>
          <p className="mt-1 text-slate-600 dark:text-slate-300">Found by: {listingSignals}.</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-white/80 p-3 text-sm dark:border-amber-300/15 dark:bg-slate-950/50">
          <div className="font-bold text-slate-950 dark:text-white">Evidence used</div>
          <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-300">
            <li>Sold comps: {hasSoldComps && hasDiscount ? 'verified discount evidence' : 'missing / not strong enough'}</li>
            <li>Rent evidence: {hasRent ? 'verified' : 'needs validation'}</li>
            <li>Data quality: {hasDataQuality ? 'price and source URL present' : 'incomplete'}</li>
          </ul>
        </div>
        <div className="rounded-xl border border-amber-100 bg-white/80 p-3 text-sm dark:border-amber-300/15 dark:bg-slate-950/50">
          <div className="font-bold text-slate-950 dark:text-white">{lowScore ? "What's missing" : 'Checks before offer'}</div>
          <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-300">
            {(lowScore ? missing : checks).slice(0, 3).map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>

      {display.reasons.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {display.reasons.map((reason) => (
            <li key={`${reason.kind}-${reason.label}`} className="rounded-xl border border-amber-100 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-amber-300/15 dark:bg-slate-950/50 dark:text-slate-200">
              <span className="font-semibold">{reason.label}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{reason.subtext}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
