// frontend/lib/api.ts

// --- Base URL for the FastAPI backend (trim trailing slashes) -------------
export const BASE =
  (process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
  ).replace(/\/+$/, '') || 'http://127.0.0.1:8000';

// Small helper: JSON fetch with good error messages
async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    // Try to surface FastAPI/Pydantic error details
    let detail: any;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    throw new Error(
      `HTTP ${res.status} ${res.statusText} at ${path} — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
    );
  }

  // If there is no body (204), return undefined as any
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

// ----------------------------- AI endpoints --------------------------------
import type {
  SummaryRequest,
  SummaryResponse,
  StrategiesRequest,
  StrategiesResponse,
} from '@/types/ai';

export async function postAiSummary(body: SummaryRequest): Promise<SummaryResponse> {
  return fetchJson<SummaryResponse>('/ai/summary', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function postAiStrategies(body: StrategiesRequest): Promise<StrategiesResponse> {
  return fetchJson<StrategiesResponse>('/ai/strategies', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// (Optional) generic GET helper you might reuse elsewhere
export async function getJson<T>(path: string): Promise<T> {
  return fetchJson<T>(path, { method: 'GET' });
}
