type TopDealEvidence = Record<string, any> | null | undefined;

type TopDealLike = {
  top_deal_score?: number | null;
  top_deal_tier?: string | null;
  top_deal_reasons?: string[] | null;
  top_deal?: { score?: number | null; tier?: string | null; reasons?: string[] | null; evidence?: TopDealEvidence } | null;
  data?: { top_deal?: { score?: number | null; tier?: string | null; reasons?: string[] | null; evidence?: TopDealEvidence } | null } | null;
};

export type TopDealTierCopy = {
  badge: string;
  title: string;
  subtitle: string;
  prominent: boolean;
  lowConfidence: boolean;
};

export type TopDealReasonCopy = {
  label: string;
  subtext: string;
  kind: 'primary' | 'supporting' | 'warning';
};

export type TopDealDisplay = TopDealTierCopy & {
  score: number | null;
  tier: string;
  reasons: TopDealReasonCopy[];
  primaryReasons: TopDealReasonCopy[];
  supportingReasons: TopDealReasonCopy[];
  positives: TopDealReasonCopy[];
  warnings: TopDealReasonCopy[];
  rawReasons: string[];
  evidenceFlags: {
    has_sold_comps: boolean;
    has_verified_discount: boolean;
    has_verified_rent: boolean;
    has_price_reduction: boolean;
    has_value_add: boolean;
    has_chain_free: boolean;
    has_full_postcode: boolean;
  };
};

function toScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

function normalizeReason(value: string): string {
  return value.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
}

function extractEmbedded(property: TopDealLike) {
  return property.top_deal ?? property.data?.top_deal ?? null;
}

function getEvidenceFlags(evidence: TopDealEvidence) {
  const soldComps = evidence?.sold_comps;
  const discount = Number(soldComps?.discount_vs_comps_pct ?? evidence?.discount_vs_comps_pct ?? 0);
  const rentEvidence = String(evidence?.rent_evidence ?? '').toLowerCase();
  const signals = [
    ...(Array.isArray(evidence?.deal_signals) ? evidence?.deal_signals : []),
    ...(Array.isArray(evidence?.listing_signals) ? evidence?.listing_signals : []),
  ].map((signal) => String(signal).toLowerCase());
  return {
    has_sold_comps: Boolean(soldComps && Number(soldComps?.count ?? 0) >= 3),
    has_verified_discount: Number.isFinite(discount) && discount > 0,
    has_verified_rent: ['provided', 'verified', 'actual', 'landlord', 'agent', 'comps'].includes(rentEvidence),
    has_price_reduction: signals.some((signal) => /reduced|reduction|price_drop|price drop/.test(signal)) || Boolean((evidence as any)?.price_reduction),
    has_value_add: signals.some((signal) => /refurb|modernis|moderniz|value.?add|extension|works/.test(signal)),
    has_chain_free: signals.some((signal) => /chain.?free/.test(signal)),
    has_full_postcode: Boolean((evidence as any)?.full_postcode || (evidence as any)?.postcode_full),
  };
}

export function getTopDealTierCopy(score: number | null, tier?: string | null): TopDealTierCopy {
  if (score !== null && score >= 78) {
    return {
      badge: 'Prime',
      title: 'Prime candidate',
      subtitle: 'Best evidence-backed opportunity',
      prominent: true,
      lowConfidence: false,
    };
  }
  if (score !== null && score >= 68) {
    return {
      badge: 'Strong',
      title: 'Strong lead',
      subtitle: 'Multiple deal signals found',
      prominent: true,
      lowConfidence: false,
    };
  }
  if (score !== null && score >= 55) {
    return {
      badge: 'Watchlist',
      title: 'Watchlist lead',
      subtitle: 'Some evidence worth checking',
      prominent: true,
      lowConfidence: false,
    };
  }
  if (score !== null && score >= 45) {
    return {
      badge: 'Early',
      title: 'Early signal',
      subtitle: 'Needs validation',
      prominent: false,
      lowConfidence: true,
    };
  }
  return {
    badge: tier && tier !== 'watchlist' ? tier : 'Standard',
    title: 'Standard listing',
    subtitle: 'No strong discovery signal yet',
    prominent: false,
    lowConfidence: true,
  };
}

export function mapTopDealReason(reason: string, evidenceFlags: TopDealDisplay['evidenceFlags']): TopDealReasonCopy | null {
  const raw = String(reason || '').trim();
  if (!raw) return null;
  const r = normalizeReason(raw);

  if (/check manually|low confidence|some signals found|standard listing|no strong discovery/.test(r)) {
    return null;
  }

  if (/\bbmv\b|below market|below local sold|sold-comps|sold comps|comps median/.test(r)) {
    if (!(evidenceFlags.has_sold_comps && evidenceFlags.has_verified_discount)) return null;
    return {
      label: 'Below local sold comps',
      subtext: 'Only shown where sold-comps discount evidence exists.',
      kind: 'primary',
    };
  }
  if (/reduced|reduction|price drop|price reduction/.test(r)) {
    return {
      label: 'Price reduction found',
      subtext: 'Seller flexibility signal. Check the reduction history before offer.',
      kind: 'primary',
    };
  }
  if (/auction/.test(r)) {
    const hasDiscountEvidence = evidenceFlags.has_verified_discount || evidenceFlags.has_price_reduction;
    return {
      label: hasDiscountEvidence ? 'Auction discount angle' : 'Auction route',
      subtext: 'Check fees, legal pack, finance deadline and comparable value.',
      kind: hasDiscountEvidence ? 'primary' : 'supporting',
    };
  }
  if (/refurb|modernis|moderniz|value-add|works|improvement|extension/.test(r)) {
    return {
      label: 'Value-add potential',
      subtext: 'Refurb, extension or improvement wording suggests possible upside after works.',
      kind: 'primary',
    };
  }
  if (/strong rent|verified rent|rent evidence|yield evidence|high yield|gross yield/.test(r)) {
    return {
      label: 'Strong rent signal',
      subtext: 'Rent/yield evidence is available, but confirm achievable rent and void assumptions.',
      kind: 'primary',
    };
  }
  if (/guide|offers|oieo|negotiat/.test(r)) {
    return {
      label: 'Negotiation angle',
      subtext: evidenceFlags.has_verified_discount || evidenceFlags.has_price_reduction
        ? 'Guide/offers wording supports the discount case. Confirm with the agent.'
        : 'Guide/offers wording found, but no verified discount yet.',
      kind: 'supporting',
    };
  }
  if (/chain-free|chain free/.test(r)) {
    return {
      label: 'Cleaner purchase path',
      subtext: 'Chain-free can reduce completion risk and delays.',
      kind: 'supporting',
    };
  }
  if (/garden|outdoor/.test(r)) {
    return {
      label: 'Outdoor space',
      subtext: 'Useful supporting feature; confirm condition and local demand.',
      kind: 'supporting',
    };
  }
  if (/station|transport|tube|rail/.test(r)) {
    return {
      label: 'Near station',
      subtext: 'Transport access can support demand; verify walking distance.',
      kind: 'supporting',
    };
  }
  if (/parking|driveway|garage/.test(r)) {
    return {
      label: 'Parking',
      subtext: 'Parking can support tenant/buyer demand; verify availability.',
      kind: 'supporting',
    };
  }
  if (/rent needs|rent evidence|proxy rent|verify rent|validate rent|estimated rent|weak rent/.test(r)) {
    return {
      label: 'Rent needs checking',
      subtext: 'Rent is estimated or weak. Confirm with live rental comparables.',
      kind: 'warning',
    };
  }
  if (/thin comps|comps.*thin|few comps|missing comps/.test(r)) {
    return {
      label: 'Comps are thin',
      subtext: 'Comparable sales evidence is limited. Check recent sold prices manually.',
      kind: 'warning',
    };
  }
  if (/no verified discount|missing discount|discount.*missing/.test(r)) {
    return {
      label: 'No verified discount yet',
      subtext: 'Do not treat this as below-market until sold-comps evidence supports it.',
      kind: 'warning',
    };
  }
  if (/legal pack|finance|cash-buyer|cash buyer|unmortgageable/.test(r)) {
    return {
      label: 'Finance/legal pack needed',
      subtext: 'Review finance route, fees, legal pack and lender constraints.',
      kind: 'warning',
    };
  }
  if (/outlier|risk|short lease|cash-buyer|unmortgageable|manual|missing|thin/.test(r)) {
    return {
      label: raw.replace(/\.$/, ''),
      subtext: 'Review this risk before offer.',
      kind: 'warning',
    };
  }

  return {
    label: raw.replace(/\.$/, ''),
    subtext: 'Validate this signal with the agent and source listing.',
    kind: 'supporting',
  };
}

export function getTopDealWarningCopy(warning: TopDealReasonCopy | string): string {
  return typeof warning === 'string' ? warning : warning.subtext;
}

export function shouldShowTopDealCard(score: number | null, reasons: unknown): boolean {
  if (score === null) return Array.isArray(reasons) && reasons.length > 0;
  return score >= 45;
}

export function shouldShowDealFinderOnCard(display: TopDealDisplay | null): boolean {
  if (!display || display.score === null) return false;
  if (display.score < 45) return false;
  if (display.score < 55 && display.reasons.length === 0) return false;
  return true;
}

export function isProminentDealFinder(display: TopDealDisplay | null): boolean {
  return Boolean(
    typeof display?.score === 'number' &&
    display.score >= 55,
  );
}

function reasonPriority(reason: TopDealReasonCopy): number {
  const label = reason.label.toLowerCase();
  if (/below local sold comps/.test(label)) return 10;
  if (/price reduction found/.test(label)) return 20;
  if (/auction discount angle/.test(label)) return 30;
  if (/auction route/.test(label)) return 35;
  if (/value-add potential/.test(label)) return 40;
  if (/strong rent signal/.test(label)) return 50;
  if (/negotiation angle/.test(label)) return 60;
  if (/cleaner purchase path/.test(label)) return 70;
  if (/outdoor space/.test(label)) return 80;
  if (/near station/.test(label)) return 90;
  if (/parking/.test(label)) return 100;
  return reason.kind === 'warning' ? 200 : 150;
}

export function getTopDealDisplay(property: TopDealLike): TopDealDisplay | null {
  const embedded = extractEmbedded(property);
  const score = toScore(property.top_deal_score) ?? toScore(embedded?.score);
  const tier = String(property.top_deal_tier || embedded?.tier || '').trim().toLowerCase() || 'watchlist';
  const rawReasons = (Array.isArray(property.top_deal_reasons)
    ? property.top_deal_reasons
    : Array.isArray(embedded?.reasons)
      ? embedded.reasons
      : [])
    .filter((reason): reason is string => typeof reason === 'string' && reason.trim().length > 0);

  const evidenceFlags = getEvidenceFlags(embedded?.evidence);
  const tierCopy = getTopDealTierCopy(score, tier);
  const seen = new Set<string>();
  const mapped = rawReasons
    .map((reason) => mapTopDealReason(reason, evidenceFlags))
    .filter((reason): reason is TopDealReasonCopy => Boolean(reason))
    .filter((reason) => {
      const key = reason.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const primaryReasons = mapped.filter((reason) => reason.kind === 'primary').sort((a, b) => reasonPriority(a) - reasonPriority(b));
  const supportingReasons = mapped.filter((reason) => reason.kind === 'supporting').sort((a, b) => reasonPriority(a) - reasonPriority(b));
  const warnings = mapped.filter((reason) => reason.kind === 'warning').slice(0, 1);
  const hasOnlySupporting = primaryReasons.length === 0 && supportingReasons.length > 0;
  const generatedWarnings: TopDealReasonCopy[] = [];

  if (hasOnlySupporting && score !== null && score < 68 && !warnings.some((warning) => warning.label === 'No verified discount yet')) {
    generatedWarnings.push({
      label: 'No verified discount yet',
      subtext: 'Useful listing signal, but no sold-comps discount evidence yet.',
      kind: 'warning',
    });
  }

  const selectedWarnings = [...warnings, ...generatedWarnings].slice(0, 1);
  const selectedPrimary = primaryReasons[0]?.label === 'Below local sold comps' && primaryReasons[1]?.label === 'Price reduction found'
    ? primaryReasons.slice(0, 2)
    : primaryReasons.slice(0, 1);
  const selectedSupporting = supportingReasons.slice(0, 1);
  const reasons = [...selectedPrimary, ...selectedSupporting, ...selectedWarnings];
  const positives = [...primaryReasons, ...supportingReasons];

  if (score === null && rawReasons.length === 0) return null;

  return {
    ...tierCopy,
    score,
    tier,
    rawReasons,
    reasons,
    primaryReasons,
    supportingReasons,
    positives,
    warnings: selectedWarnings,
    evidenceFlags,
  };
}
