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

/* ------------------------------------------------------------------ */
/* Resilient fetch (timeout + retries)                                 */
/* ------------------------------------------------------------------ */

export type FetchRetryOptions = {
  retries?: number;      // default 2
  retryDelayMs?: number; // default 400
  timeoutMs?: number;    // default 10_000
  signal?: AbortSignal;  // optional external signal to pass through
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: FetchRetryOptions = {}
): Promise<Response> {
  const retries = opts.retries ?? 2;
  const delay = opts.retryDelayMs ?? 400;
  const timeout = opts.timeoutMs ?? 10_000;

  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(input, {
        ...init,
        signal: init.signal ?? opts.signal ?? controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok && res.status >= 500 && attempt < retries) {
        await sleep(delay * (attempt + 1));
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const detail = text || res.statusText || "Request failed";
        throw new Error(`HTTP ${res.status}: ${detail}`);
      }

      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        await sleep(delay * (attempt + 1));
        continue;
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("Network error");
}

/* ------------------------------------------------------------------ */
/* Generic helpers                                                     */
/* ------------------------------------------------------------------ */

export async function apiPost<T = unknown>(
  path: string,
  body: JSONValue,
  init?: RequestInit,
  opts?: FetchRetryOptions
): Promise<T> {
  const url = buildUrl(path);
  const res = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      body: JSON.stringify(body),
      ...init,
    },
    opts
  );
  return (await res.json()) as T;
}

export async function apiGet<T = unknown>(
  path: string,
  init?: RequestInit,
  opts?: FetchRetryOptions
): Promise<T> {
  const url = buildUrl(path);
  const res = await fetchWithRetry(url, { method: "GET", ...(init || {}) }, opts);
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

export function postAiSummary(
  payload: SummaryRequest | { property: SummaryRequest },
  opts?: FetchRetryOptions
): Promise<SummaryResponse> {
  const body =
    "property" in payload ? payload : { property: payload as SummaryRequest };
  return apiPost<SummaryResponse>("/generate-summary", body, undefined, opts);
}

export function postAiStrategies(
  payload: StrategiesRequest | { property: StrategiesRequest },
  opts?: FetchRetryOptions
): Promise<StrategiesResponse> {
  const body =
    "property" in payload ? payload : { property: payload as StrategiesRequest };
  return apiPost<StrategiesResponse>("/generate-strategies", body, undefined, opts);
}
