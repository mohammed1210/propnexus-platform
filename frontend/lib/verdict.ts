import { fmtGBP, fmtPct } from '@/lib/format';
import { normalizeProperty } from '@/lib/normalizeProperty';

export type VerdictTone = 'positive' | 'neutral' | 'caution';

export type VerdictInput = {
  yield_percent?: number | null;
  roi_percent?: number | null;
  ai_score?: number | null;
  score?: number | null;
  discount_percent?: number | null;
  price?: number | null;
  asking_price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  investmentType?: string | null;
  propertyType?: string | null;
};

export type VerdictOutput = {
  label: string;
  tone: VerdictTone;
  sentence: string;
  bullets: string[];
  highlights: string[];
};

function toNum(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function scoreBucket(score: number): { points: number; label: string } {
  if (score >= 80) return { points: 2, label: 'High AI score' };
  if (score >= 65) return { points: 1, label: 'Good AI score' };
  if (score > 0 && score < 50) return { points: -1, label: 'Low AI score' };
  return { points: 0, label: 'AI score' };
}

function yieldBucket(yieldPct: number): { points: number; label: string } {
  if (yieldPct >= 6) return { points: 2, label: 'Strong yield' };
  if (yieldPct >= 4) return { points: 1, label: 'Decent yield' };
  if (yieldPct > 0) return { points: -1, label: 'Low yield' };
  return { points: 0, label: 'Yield' };
}

function roiBucket(roiPct: number): { points: number; label: string } {
  if (roiPct >= 12) return { points: 2, label: 'Strong ROI' };
  if (roiPct >= 8) return { points: 1, label: 'Decent ROI' };
  if (roiPct > 0) return { points: -1, label: 'Low ROI' };
  return { points: 0, label: 'ROI' };
}

function discountBucket(discountPct: number): { points: number; label: string } {
  if (discountPct >= 20) return { points: 2, label: 'Large discount' };
  if (discountPct >= 10) return { points: 1, label: 'Discount' };
  if (discountPct > 0) return { points: 0, label: 'Small discount' };
  return { points: 0, label: 'Discount' };
}

export function buildVerdict(input: VerdictInput): VerdictOutput {
  const normProp = normalizeProperty(input as any);
  const yieldPct = typeof normProp.yieldPercent === 'number' ? normProp.yieldPercent : toNum(input.yield_percent);
  const roiPct = typeof normProp.roiPercent === 'number' ? normProp.roiPercent : toNum(input.roi_percent);
  const usedRoiProxy = Boolean((normProp as any).roiIsProxy);
  const score = toNum(input.ai_score ?? input.score);
  const discountPct = toNum(input.discount_percent);

  const price = toNum(input.asking_price ?? input.price ?? normProp.price);
  const bedrooms = toNum(input.bedrooms ?? normProp.bedrooms);
  const bathrooms = toNum(input.bathrooms ?? normProp.bathrooms);

  const signals: Array<{ points: number; label: string }> = [];
  if (typeof yieldPct === 'number') signals.push(yieldBucket(yieldPct));
  if (typeof roiPct === 'number') signals.push(roiBucket(roiPct));
  if (typeof score === 'number') signals.push(scoreBucket(score));
  if (typeof discountPct === 'number') signals.push(discountBucket(discountPct));

  const totalPoints = signals.reduce((acc, s) => acc + s.points, 0);
  const normalized = clamp(totalPoints, -3, 5);

  let tone: VerdictTone = 'neutral';
  // Investor-facing label: avoid uncertainty language like "Mixed".
  let label = 'Balanced Strategy';

  if (normalized >= 4) {
    tone = 'positive';
    label = 'Strong';
  } else if (normalized >= 2) {
    tone = 'positive';
    label = 'Promising';
  } else if (normalized <= -1) {
    tone = 'caution';
    label = 'Caution';
  }

  const highlights: string[] = [];
  if (typeof yieldPct === 'number') highlights.push(`${fmtPct(yieldPct)} yield`);
  if (typeof roiPct === 'number') highlights.push(`${fmtPct(roiPct)} ${usedRoiProxy ? 'ROI (proxy)' : 'ROI'}`);
  if (typeof discountPct === 'number') highlights.push(`${discountPct.toFixed(0)}% discount`);
  if (typeof score === 'number') highlights.push(`${Math.round(score)}/100 score`);

  const bullets: string[] = [];
  if (typeof yieldPct === 'number') bullets.push(`Yield: ${fmtPct(yieldPct)} (rule-based)`);
  if (typeof roiPct === 'number') bullets.push(`ROI: ${fmtPct(roiPct)} (${usedRoiProxy ? 'cash-on-cash proxy' : 'rule-based'})`);
  if (typeof discountPct === 'number') bullets.push(`Discount: ${discountPct.toFixed(0)}% (if estimated value is accurate)`);
  if (typeof score === 'number') bullets.push(`Stored score: ${Math.round(score)}/100`);

  if (typeof price === 'number') {
    const bedText = typeof bedrooms === 'number' && bedrooms > 0 ? ` · ${bedrooms} bed` : '';
    const bathText = typeof bathrooms === 'number' && bathrooms > 0 ? ` · ${bathrooms} bath` : '';
    bullets.push(`Asking: ${fmtGBP(price)}${bedText}${bathText}`);
  } else if (typeof bedrooms === 'number' || typeof bathrooms === 'number') {
    bullets.push(`Layout: ${bedrooms ?? '—'} bed · ${bathrooms ?? '—'} bath`);
  }

  // Keep TL;DR compact: 2–3 bullets max, prioritizing yield/roi/discount/price.
  const compactBullets = bullets.slice(0, 3);

  const sentenceParts: string[] = [];
  if (typeof yieldPct === 'number') sentenceParts.push(`~${fmtPct(yieldPct)} yield`);
  if (typeof roiPct === 'number') sentenceParts.push(`~${fmtPct(roiPct)} ${usedRoiProxy ? 'ROI (proxy)' : 'ROI'}`);
  if (typeof discountPct === 'number') sentenceParts.push(`~${discountPct.toFixed(0)}% discount`);

  const sentence =
    sentenceParts.length > 0
      ? `${label} on paper: ${sentenceParts.join(' · ')}.`
      : typeof score === 'number'
        ? `${label} based on the stored score.`
        : `${label} based on available listing fields.`;

  return {
    label,
    tone,
    sentence,
    bullets: compactBullets,
    highlights: highlights.slice(0, 2),
  };
}

export function verdictToneClasses(tone: VerdictTone): string {
  if (tone === 'positive') return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/15 dark:text-emerald-200 dark:border-emerald-800/40';
  if (tone === 'caution') return 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/15 dark:text-rose-200 dark:border-rose-800/40';
  return 'bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-900/20 dark:text-slate-200 dark:border-slate-800';
}
