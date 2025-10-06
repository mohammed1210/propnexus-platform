// frontend/lib/api.ts
import type {
  SummaryRequest,
  SummaryResponse,
  StrategiesRequest,
  StrategiesResponse,
} from '@/types/ai';

type JSONValue = any;

// Resolve API base once and reuse
const BASE =
  (process.env.NEXT_PUBLIC_API_BASE as string | undefined) ??
  (process.env.NEXT_PUBLIC_API_BASE_URL as string | undefined) ??
  '';

/** Exporting BASE only in case another helper needs it (safe to keep). */
export { BASE };

/** Generic POST that returns a typed payload */
export async function apiPost<T>(path: string, body: JSONValue): Promise<T> {
  const url = `${BASE.replace(/\/+$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/* --------- AI endpoints (typed) --------- */
export function postAiSummary(payload: SummaryRequest): Promise<SummaryResponse> {
  return apiPost<SummaryResponse>('/ai/generate-summary', payload);
}

export function postAiStrategies(payload: StrategiesRequest): Promise<StrategiesResponse> {
  return apiPost<StrategiesResponse>('/ai/generate-strategies', payload);
}
