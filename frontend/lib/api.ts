// frontend/lib/api.ts

// Base URL for the FastAPI backend. Trim any trailing slashes.
export const BASE =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, '') as string | undefined) ||
  'http://127.0.0.1:8000';

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

/** Generic POST used around the app (kept for back-compat). */
export async function apiPost<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const url = path.startsWith('http')
    ? path
    : `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify((body ?? {}) as unknown),
  });

  return handle<TRes>(res);
}

/** --- PO2 AI routes (typed) --- */
export interface SummaryRequest {
  title: string;
  price?: number;
  location: string;
  yield_?: number;
  roi?: number;
  description?: string;
}

export interface SummaryResponse {
  summary: string;
  bullets: string[];
}

export interface StrategiesRequest {
  property: Record<string, unknown>;
  constraints?: Record<string, unknown>;
}

export interface Strategy {
  title: string;
  rationale: string;
  steps: string[];
  risk: string;
}

export interface StrategiesResponse {
  strategies: Strategy[];
}

export function postAiSummary(payload: SummaryRequest): Promise<SummaryResponse> {
  return apiPost<SummaryRequest, SummaryResponse>('/ai/summary', payload);
}

export function postAiStrategies(payload: StrategiesRequest): Promise<StrategiesResponse> {
  return apiPost<StrategiesRequest, StrategiesResponse>('/ai/strategies', payload);
}
