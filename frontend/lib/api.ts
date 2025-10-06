// frontend/lib/api.ts
/* Centralised API helpers + AI wrappers */

import type {
  SummaryRequest,
  SummaryResponse,
  StrategiesRequest,
  StrategiesResponse,
} from '@/types/ai';

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE as string | undefined) ??
  (process.env.NEXT_PUBLIC_API_BASE_URL as string | undefined) ??
  '';

const base = API_BASE.replace(/\/+$/, '');

const toUrl = (path: string) =>
  path.startsWith('http') ? path : `${base}${path}`;

/** GET helper with typing */
export async function apiGet<T = unknown>(path: string): Promise<T> {
  const r = await fetch(toUrl(path), { cache: 'no-store' });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return (await r.json()) as T;
}

/** POST helper with typing */
export async function apiPost<T = unknown>(
  path: string,
  body?: unknown
): Promise<T> {
  const r = await fetch(toUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return (await r.json()) as T;
}

/* ---------- AI wrappers (typed) ---------- */

export const postAiSummary = (payload: SummaryRequest) =>
  apiPost<SummaryResponse>('/ai/generate-summary', payload);

export const postAiStrategies = (payload: StrategiesRequest) =>
  apiPost<StrategiesResponse>('/ai/generate-strategies', payload);
