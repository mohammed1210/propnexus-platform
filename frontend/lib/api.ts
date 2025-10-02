// frontend/lib/api.ts
/**
 * Central API client used by Listings, Property pages, Off-Market, and AI helpers.
 * - Reads NEXT_PUBLIC_API_BASE (set in .env.production.local for Vercel).
 * - Falls back to legacy env names to remain compatible.
 * - Exposes getJson/postJson, plus AI helpers.
 * - Keeps a backwards-compat export `apiPost` used in older pages.
 */

const envBase =
  (process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "").replace(/\/+$/, "");

export const BASE: string = envBase || "http://127.0.0.1:8000";

type Json = Record<string, unknown> | unknown[];

/** Low-level fetch with sane defaults */
async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) headers.set("content-type", "application/json");

  const res = await fetch(url, { ...init, headers, credentials: "omit" });
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const err = (body as any)?.detail || (body as any)?.error || body;
    throw new Error(typeof err === "string" ? err : JSON.stringify(err));
  }
  return body as T;
}

export const getJson = <T>(path: string, init?: RequestInit) =>
  request<T>(path, { ...init, method: "GET" });

export const postJson = <T>(path: string, data?: Json, init?: RequestInit) =>
  request<T>(path, {
    ...init,
    method: "POST",
    body: data != null ? JSON.stringify(data) : undefined,
  });

/** ---------------- AI helpers ---------------- */
import type {
  SummaryRequest,
  SummaryResponse,
  StrategiesRequest,
  StrategiesResponse,
} from "@/types/ai";

export function postAiSummary(payload: SummaryRequest) {
  return postJson<SummaryResponse>("/ai/summary", payload);
}

export function postAiStrategies(payload: StrategiesRequest) {
  return postJson<StrategiesResponse>("/ai/strategies", payload);
}

/** ------------- Back-compat for old imports ------------- */
/** Some older pages do: `import { apiPost } from '@/lib/api'` */
export const apiPost = postJson;
