// frontend/lib/api.ts

// -------- Base URL for the FastAPI backend --------
// Priority:
// 1) NEXT_PUBLIC_API_BASE (new, preferred)
// 2) NEXT_PUBLIC_BACKEND_URL / NEXT_PUBLIC_API_URL (legacy fallbacks)
// 3) http://127.0.0.1:8000 (local dev)
export const BASE =
  (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '') ||
  (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000');

// Generic helpers
export async function apiGet<T>(path: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GET ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Try to surface FastAPI error details nicely
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.detail ? ` ${JSON.stringify(j.detail)}` : '';
    } catch {
      detail = ` ${(await res.text().catch(() => '')).slice(0, 500)}`;
    }
    throw new Error(`POST ${path} failed: ${res.status}${detail}`);
  }
  return res.json() as Promise<T>;
}

// ---------- AI endpoints ----------
import type {
  SummaryRequest,
  SummaryResponse,
  StrategiesRequest,
  StrategiesResponse,
} from '@/types/ai';

export function postAiSummary(body: SummaryRequest) {
  return apiPost<SummaryResponse>('/ai/summary', body);
}

export function postAiStrategies(body: StrategiesRequest) {
  return apiPost<StrategiesResponse>('/ai/strategies', body);
}
