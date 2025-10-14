// frontend/lib/api.ts

// Keep this exported so other helpers (e.g. lib/ai.ts) can reuse it.
export const BASE =
  (process.env.NEXT_PUBLIC_API_BASE as string | undefined) ??
  (process.env.NEXT_PUBLIC_API_BASE_URL as string | undefined) ??
  '';

// Narrow JSON typing isn’t critical here; keep it flexible.
type JSONValue = any;

/** Build an absolute URL from the public API base + path */
function buildUrl(path: string): string {
  const base = BASE.replace(/\/+$/, '');
  const tail = path.startsWith('/') ? path : `/${path}`;
  return `${base}${tail}`;
}

/* ------------------------------------------------------------------ */
/* Resilient fetch (timeout + retries)                                 */
/* ------------------------------------------------------------------ */

export type FetchRetryOptions = {
  retries?: number;       // default 2 (total attempts = retries + 1)
  retryDelayMs?: number;  // default 400 (exponential-ish backoff)
  timeoutMs?: number;     // default 10_000
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Merge two AbortSignals into one (aborts if either aborts). */
function mergeSignals(a?: AbortSignal | null, b?: AbortSignal | null) {
  if (!a && !b) return undefined;
  const c = new AbortController();

  const onAbortA = () => c.abort((a as any)?.reason);
  const onAbortB = () => c.abort((b as any)?.reason);

  if (a) {
    if (a.aborted) c.abort((a as any).reason);
    else a.addEventListener("abort", onAbortA);
  }
  if (b) {
    if (b.aborted) c.abort((b as any).reason);
    else b.addEventListener("abort", onAbortB);
  }

  // Provide a small cleanup helper to callers
  return {
    signal: c.signal,
    cleanup: () => {
      a?.removeEventListener("abort", onAbortA);
      b?.removeEventListener("abort", onAbortB);
    },
  };
}

/**
 * fetchWithRetry
 * - Respects an external init.signal (so React AbortController keeps working)
 * - Adds a timeout (per attempt)
 * - Retries on transient server errors (>=500) and 429
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: FetchRetryOptions = {},
): Promise<Response> {
  const retries = opts.retries ?? 2;
  const baseDelay = opts.retryDelayMs ?? 400;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Timeout controller (per attempt)
    const timeoutCtrl = new AbortController();
    const timer = setTimeout(() => timeoutCtrl.abort(new DOMException("Timeout", "AbortError")), timeoutMs);

    // Respect external signal by merging with our timeout signal
    const externalSignal = init.signal as AbortSignal | undefined;
    const merged = mergeSignals(externalSignal, timeoutCtrl.signal);

    try {
      const res = await fetch(input, { ...init, signal: merged?.signal });

      // Done with listeners for this attempt
      merged?.cleanup?.();
      clearTimeout(timer);

      // Retry only on transient errors
      if (!res.ok && (res.status === 429 || res.status >= 500) && attempt < retries) {
        const delay = baseDelay * (attempt + 1);
        await sleep(delay);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const detail = text || res.statusText || 'Request failed';
        throw new Error(`HTTP ${res.status}: ${detail}`);
      }

      return res;
    } catch (err) {
      merged?.cleanup?.();
      clearTimeout(timer);
      lastErr = err;

      // If aborted by external signal, don’t retry
      if ((err as any)?.name === "AbortError" && externalSignal?.aborted) {
        throw err;
      }

      if (attempt < retries) {
        const delay = baseDelay * (attempt + 1);
        await sleep(delay);
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('Network error');
}

/* ------------------------------------------------------------------ */
/* Generic helpers                                                     */
/* ------------------------------------------------------------------ */

export async function apiPost<T = unknown>(
  path: string,
  body: JSONValue,
  init?: RequestInit,
  opts?: FetchRetryOptions,
): Promise<T> {
  const url = buildUrl(path);
  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      body: JSON.stringify(body),
      ...init,
    },
    opts,
  );
  return (await res.json()) as T;
}

export async function apiGet<T = unknown>(
  path: string,
  init?: RequestInit,
  opts?: FetchRetryOptions,
): Promise<T> {
  const url = buildUrl(path);
  const res = await fetchWithRetry(url, { method: 'GET', ...(init || {}) }, opts);
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
} from '@/types/ai';

export function postAiSummary(
  payload: SummaryRequest | { property: SummaryRequest },
  opts?: FetchRetryOptions,
): Promise<SummaryResponse> {
  // The backend accepts either flat {title,...} or {property:{...}}
  const body = 'property' in payload ? payload : { property: payload as SummaryRequest };
  return apiPost<SummaryResponse>('/generate-summary', body, undefined, opts);
}

export function postAiStrategies(
  payload: StrategiesRequest | { property: StrategiesRequest },
  opts?: FetchRetryOptions,
): Promise<StrategiesResponse> {
  const body = 'property' in payload ? payload : { property: payload as StrategiesRequest };
  return apiPost<StrategiesResponse>('/generate-strategies', body, undefined, opts);
}
