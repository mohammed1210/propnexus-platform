// frontend/lib/api.ts

// Keep this exported so other helpers (e.g. lib/ai.ts) can reuse it.
export const BASE =
  (process.env.NEXT_PUBLIC_API_BASE as string | undefined) ??
  (process.env.NEXT_PUBLIC_API_BASE_URL as string | undefined) ??
  "";

// Narrow JSON typing isn’t critical here; keep it flexible.
type JSONValue = any;

/** Build an absolute URL from the public API base + path */
function buildUrl(path: string): string {
  const base = BASE.replace(/\/+$/, "");
  const tail = path.startsWith("/") ? path : `/${path}`;
  return `${base}${tail}`;
}

/** Generic POST that returns a typed JSON response */
export async function apiPost<T = unknown>(
  path: string,
  body: JSONValue,
  init?: RequestInit
): Promise<T> {
  const url = buildUrl(path);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });

  if (!res.ok) {
    // Surface meaningful errors to the UI
    const text = await res.text().catch(() => "");
    const detail = text || res.statusText || "Request failed";
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }

  // Important: return a typed Promise so callers don’t see `unknown`
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/* AI endpoints (typed)                                                */
/* ------------------------------------------------------------------ */

import type {
  SummaryRequest,
  SummaryResponse,
  StrategiesRequest,
  StrategiesResponse,
} from "@/types/ai";

/** POST /generate-summary */
export function postAiSummary(
  payload: SummaryRequest | { property: SummaryRequest }
): Promise<SummaryResponse> {
  // The backend accepts either flat {title,...} or {property:{...}}
  const body =
    "property" in payload ? payload : { property: payload as SummaryRequest };
  return apiPost<SummaryResponse>("/generate-summary", body);
}

/** POST /generate-strategies */
export function postAiStrategies(
  payload: StrategiesRequest | { property: StrategiesRequest }
): Promise<StrategiesResponse> {
  const body =
    "property" in payload ? payload : { property: payload as StrategiesRequest };
  return apiPost<StrategiesResponse>("/generate-strategies", body);
}
