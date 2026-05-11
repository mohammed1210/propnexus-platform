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
  kind: 'positive' | 'warning';
};

export type TopDealDisplay = TopDealTierCopy & {
  score: number | null;
  tier: string;
  reasons: TopDealReasonCopy[];
  positives: TopDealReasonCopy[];
  warnings: TopDealReasonCopy[];
  rawReasons: string[];
  evidenceFlags: {
    has_sold_comps: boolean;
    has_verified_discount: boolean;
    has_verified_rent: boolean;
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
  return {
    has_sold_comps: Boolean(soldComps && Number(soldComps?.count ?? 0) >= 3),
    has_verified_discount: Number.isFinite(discount) && discount > 0,
    has_verified_rent: ['provided', 'verified', 'actual', 'landlord', 'agent', 'comps'].includes(rentEvidence),
  };
}

export function getTopDealTierCopy(score: number | null, tier?: string | null): TopDealTierCopy {
  if (score !== null && score >= 78) {
    return {
      badge: 'Prime',
      title: 'Prime candidate',
      subtitle: 'Strong evidence-backed deal signals',
      prominent: true,
      lowConfidence: false,
    };
  }
  if (score !== null && score >= 68) {
    return {
      badge: 'Strong',
      title: 'Strong lead',
      subtitle: 'Worth checking before the market moves',
      prominent: true,
      lowConfidence: false,
    };
  }
  if (score !== null && score >= 55) {
    return {
      badge: 'Watchlist',
      title: 'Watchlist lead',
      subtitle: 'Promising, but validate the evidence',
      prominent: true,
      lowConfidence: false,
    };
  }
  if (score !== null && score >= 35) {
    return {
      badge: 'Needs checks',
      title: 'Light signal',
      subtitle: 'Some signals found, evidence still thin',
      prominent: true,
      lowConfidence: true,
    };
  }
  return {
    badge: tier && tier !== 'watchlist' ? tier : 'Low confidence',
    title: 'Low-confidence signal',
    subtitle: 'Check manually',
    prominent: false,
    lowConfidence: true,
  };
}

export function mapTopDealReason(reason: string, evidenceFlags: TopDealDisplay['evidenceFlags']): TopDealReasonCopy | null {
  const raw = String(reason || '').trim();
  if (!raw) return null;
  const r = normalizeReason(raw);

  if (/\bbmv\b|below market|below local sold|sold-comps|sold comps|comps median/.test(r)) {
    if (!(evidenceFlags.has_sold_comps && evidenceFlags.has_verified_discount)) return null;
    return {
      label: 'Below local sold comps',
      subtext: 'Only shown where sold-comps discount evidence exists.',
      kind: 'positive',
    };
  }
  if (/chain-free|chain free/.test(r)) {
    return {
      label: 'Cleaner purchase path',
      subtext: 'Chain-free can reduce completion risk and delays.',
      kind: 'positive',
    };
  }
  if (/guide|offers|oieo|negotiat/.test(r)) {
    return {
      label: 'Negotiation angle',
      subtext: 'Guide/offers wording may indicate room to negotiate, but confirm with agent.',
      kind: 'positive',
    };
  }
  if (/auction/.test(r)) {
    return {
      label: 'Auction route',
      subtext: 'Potential speed/discount angle, but check fees, legal pack and finance.',
      kind: 'positive',
    };
  }
  if (/reduced|reduction|price drop|price reduction/.test(r)) {
    return {
      label: 'Price reduction found',
      subtext: 'May signal seller flexibility. Check previous asking price.',
      kind: 'positive',
    };
  }
  if (/refurb|modernis|moderniz|value-add|works|improvement/.test(r)) {
    return {
      label: 'Value-add angle',
      subtext: 'Condition or improvement wording suggests possible upside after works.',
      kind: 'positive',
    };
  }
  if (/rent needs|rent evidence|proxy rent|verify rent|validate rent|estimated rent|weak rent/.test(r)) {
    return {
      label: 'Rent needs checking',
      subtext: 'Rent is estimated or weak. Confirm with live rental comparables.',
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
    kind: 'positive',
  };
}

export function getTopDealWarningCopy(warning: TopDealReasonCopy | string): string {
  return typeof warning === 'string' ? warning : warning.subtext;
}

export function shouldShowTopDealCard(score: number | null, reasons: unknown): boolean {
  if (score === null) return Array.isArray(reasons) && reasons.length > 0;
  return score >= 35;
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

  const positives = mapped.filter((reason) => reason.kind === 'positive').slice(0, 2);
  const warnings = mapped.filter((reason) => reason.kind === 'warning').slice(0, 1);

  if (score === null && rawReasons.length === 0) return null;

  return {
    ...tierCopy,
    score,
    tier,
    rawReasons,
    reasons: [...positives, ...warnings],
    positives,
    warnings,
    evidenceFlags,
  };
}
