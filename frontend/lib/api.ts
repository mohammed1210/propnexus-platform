// frontend/lib/api.ts
const BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, '') ||
  'http://127.0.0.1:8000';

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
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

export async function apiPost<Req, Res>(path: string, body: Req): Promise<Res> {
  return apiFetch<Res>(path, { method: 'POST', body: JSON.stringify(body) });
}

/** ---- AI endpoints ---- */
export type SummaryRequest = {
  title: string;
  location: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  yield_percent?: number;
  roi_percent?: number;
  description?: string;
};

export type SummaryResponse = {
  summary: string;
  bullets: string[];
};

export type Strategy = {
  title: string;
  rationale: string;
  steps?: string[];
  risk?: string | null;
};

export type StrategiesRequest = {
  property: {
    title: string;
    location: string;
    price?: number;
    yield_percent?: number;
    roi_percent?: number;
    propertyType?: string;
    investmentType?: string;
    description?: string;
    bedrooms?: number;
    bathrooms?: number;
  };
  constraints?: Record<string, string | number | boolean>;
};

export type StrategiesResponse = { strategies: Strategy[] };

export function postAiSummary(payload: SummaryRequest) {
  return apiPost<SummaryRequest, SummaryResponse>('/ai/summary', payload);
}

export function postAiStrategies(payload: StrategiesRequest) {
  return apiPost<StrategiesRequest, StrategiesResponse>('/ai/strategies', payload);
}
