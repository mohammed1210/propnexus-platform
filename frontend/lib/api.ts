// frontend/lib/api.ts
import type {
  SummaryRequest,
  SummaryResponse,
  StrategiesRequest,
  StrategiesResponse,
} from '@/types/ai';

const BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, '') || 'http://127.0.0.1:8000';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`API ${resp.status}: ${txt || resp.statusText}`);
  }
  return (await resp.json()) as T;
}

export function apiPost<Req, Res>(path: string, body: Req): Promise<Res> {
  return apiFetch<Res>(path, { method: 'POST', body: JSON.stringify(body) });
}

/** ---- AI endpoints ---- */
export function postAiSummary(payload: SummaryRequest) {
  return apiPost<SummaryRequest, SummaryResponse>('/ai/summary', payload);
}

export function postAiStrategies(payload: StrategiesRequest) {
  return apiPost<StrategiesRequest, StrategiesResponse>('/ai/strategies', payload);
}
