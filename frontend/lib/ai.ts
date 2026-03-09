import { BASE } from './api';

/**
 * Minimal shape we need from a property-like object to talk to the backend.
 * Map your domain fields into these before calling the helpers below.
 */
export type PropertyForAI = {
  id?: string;
  title?: string | null;
  address?: string | null; // many cards use this for display
  location?: string | null; // postcode/town/city if available
  price?: number | string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  yield_percent?: number | string | null;
  roi_percent?: number | string | null;
  propertyType?: string | null;
  investmentType?: string | null;
  description?: string | null;
};

type SummaryResponse = { summary: string; bullets: string[] };
type StrategiesResponse = { strategies: any[] };

/** Coerce possibly-formatted number input to a finite number, or return undefined. */
function coerceNumber(n: unknown): number | undefined {
  if (n === null || n === undefined || n === '') return undefined;
  if (typeof n === 'number') return Number.isFinite(n) ? n : undefined;
  if (typeof n === 'string') {
    const cleaned = n.replace(/[,_£\s]/g, '');
    const out = Number(cleaned);
    return Number.isFinite(out) ? out : undefined;
  }
  return undefined;
}

/** Normalize title/location and numeric fields for the AI endpoints. */
function buildSummaryBody(p: PropertyForAI) {
  const title = (p.title && p.title.trim()) || (p.address && p.address.trim()) || 'Property';

  return {
    title,
    location: String(p.location ?? p.address ?? ''),
    price: coerceNumber(p.price),
    bedrooms: coerceNumber(p.bedrooms),
    bathrooms: coerceNumber(p.bathrooms),
    yield_percent: coerceNumber(p.yield_percent),
    roi_percent: coerceNumber(p.roi_percent),
    propertyType: p.propertyType ?? undefined,
    investmentType: p.investmentType ?? undefined,
    description: p.description ?? undefined,
  };
}

/** Fetch wrapper that throws a helpful error message with backend details. */
async function requestJSON<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const base = (BASE || '').replace(/\/+$/, '');
  if (!base) {
    throw new Error(
      '[ai] BASE URL is empty. Set NEXT_PUBLIC_API_BASE.',
    );
  }

  const { timeoutMs, ...rest } = init;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const id = timeoutMs && controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller?.signal,
    });

    if (!res.ok) {
      let detail: unknown;
      try {
        detail = await res.json();
      } catch {
        /* ignore */
      }
      const suffix = detail ? ` — ${JSON.stringify(detail)}` : ` — ${res.statusText}`;
      throw new Error(`${rest.method ?? 'GET'} ${url} failed (${res.status})${suffix}`);
    }
    return (await res.json()) as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out: ${rest.method ?? 'GET'} ${url}`);
    }
    throw err;
  } finally {
    if (id) clearTimeout(id);
  }
}

/** Call POST /ai/summary with a normalized payload. */
export async function getAISummary(p: PropertyForAI): Promise<SummaryResponse> {
  const body = buildSummaryBody(p);
  const base = (BASE || '').replace(/\/+$/, '');
  return requestJSON<SummaryResponse>(`${base}/ai/summary`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 15_000,
  });
}

/** Call POST /ai/strategies with a normalized payload (and optional constraints). */
export async function getAIStrategies(
  p: PropertyForAI,
  constraints?: Record<string, unknown>,
): Promise<StrategiesResponse> {
  const property = buildSummaryBody(p);
  const base = (BASE || '').replace(/\/+$/, '');
  return requestJSON<StrategiesResponse>(`${base}/ai/strategies`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ property, constraints }),
    timeoutMs: 25_000,
  });
}
