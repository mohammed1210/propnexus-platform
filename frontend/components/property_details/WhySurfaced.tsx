import { getTopDealDisplay } from '@/lib/topDealCopy';

type WhySurfacedProperty = {
  postcode?: string | null;
  postcode_full?: string | null;
  postcodeFull?: string | null;
  postal_code?: string | null;
  postalCode?: string | null;
  source_url?: string | null;
  listing_url?: string | null;
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

function getCopy(score: number | null) {
  if (score !== null && score >= 68) {
    return {
      title: 'Why PropNexus surfaced this',
      subtitle: 'Strong discovery signals found before deeper due diligence.',
    };
  }
  if (score !== null && score >= 55) {
    return {
      title: 'Why this is on the watchlist',
      subtitle: 'Some useful signals found, but validate before bidding.',
    };
  }
  if (score !== null && score >= 45) {
    return {
      title: 'Early signal found',
      subtitle: 'This may be worth checking, but evidence is still light.',
    };
  }
  return {
    title: 'Not a top deal yet',
    subtitle: 'PropNexus found limited signals. Treat this as a standard listing unless further evidence improves.',
  };
}

function hasFullPostcode(property: WhySurfacedProperty, evidence: Record<string, unknown> | null): boolean {
  if ((evidence as any)?.full_postcode || (evidence as any)?.postcode_full) return true;
  const postcode = String(property.postcode_full ?? property.postcodeFull ?? property.postcode ?? property.postal_code ?? property.postalCode ?? '').trim();
  return /[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i.test(postcode);
}

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
  const hasPriceReduction = Boolean(display?.evidenceFlags.has_price_reduction || display?.positives.some((r) => /price reduction/i.test(r.label)));
  const hasValueAdd = Boolean(display?.evidenceFlags.has_value_add || display?.positives.some((r) => /value-add/i.test(r.label)));
  const hasChainFree = Boolean(display?.evidenceFlags.has_chain_free || display?.positives.some((r) => /cleaner purchase/i.test(r.label)));
  const fullPostcode = hasFullPostcode(property, evidence as Record<string, unknown> | null);
  const hasSourceUrl = Boolean((evidence as any)?.has_source_url || property.source_url || property.listing_url);
  const copy = getCopy(score);
  const hasEvidenceBackedSignal = hasSoldComps || hasRent || hasPriceReduction || hasDiscount || hasValueAdd;

  if (!display) return null;

  const groups = [
    {
      label: 'Price signal',
      value: hasPriceReduction
        ? 'Price reduction found'
        : hasDiscount
          ? 'Verified discount vs sold comps'
          : 'No verified reduction found',
    },
    {
      label: 'Comps evidence',
      value: hasSoldComps ? 'Sold comps available' : 'Missing',
    },
    {
      label: 'Rent evidence',
      value: hasRent
        ? 'Rent evidence available'
        : display.warnings.some((warning) => /rent/i.test(warning.label))
          ? 'Estimated'
          : 'Missing',
    },
    {
      label: 'Value-add signal',
      value: hasValueAdd ? 'Refurb/extension wording found' : 'Missing',
    },
    {
      label: 'Purchase friction',
      value: hasChainFree ? 'Chain-free' : 'Unknown',
    },
    {
      label: 'Data quality',
      value: fullPostcode ? 'Full postcode' : hasSourceUrl ? 'Source listing only' : 'Outward postcode only',
    },
  ];

  return (
    <section className="border-t border-slate-200 bg-amber-50/60 p-5 dark:border-slate-800 dark:bg-amber-400/10 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">
            {hasEvidenceBackedSignal ? 'Discovery signal' : 'Listing-signal based'}
          </div>
          <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950 dark:text-white">
            {copy.title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-700 dark:text-slate-300">
            {copy.subtitle} This discovery readout is separate from the AI Deal Score used for deeper due diligence.
          </p>
        </div>
        <div className="w-fit rounded-2xl border border-amber-200 bg-white px-4 py-2 text-sm font-black text-amber-800 shadow-sm dark:border-amber-300/25 dark:bg-slate-950/60 dark:text-amber-100">
          Discovery score {score !== null ? `${Math.round(score)}/100` : ''}
          <span className="ml-2 text-xs font-bold opacity-75">{display.badge}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-amber-100 bg-white/80 p-3 text-sm dark:border-amber-300/15 dark:bg-slate-950/50">
          <div className="font-bold text-slate-950 dark:text-white">Listing signals</div>
          <p className="mt-1 text-slate-600 dark:text-slate-300">Found by: {listingSignals}.</p>
        </div>
        {groups.map((group) => (
          <div key={group.label} className="rounded-xl border border-amber-100 bg-white/80 p-3 text-sm dark:border-amber-300/15 dark:bg-slate-950/50">
            <div className="font-bold text-slate-950 dark:text-white">{group.label}</div>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{group.value}</p>
          </div>
        ))}
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
