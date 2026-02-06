// frontend/lib/api.ts
'use client';

export const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://propnexus-backend-production.up.railway.app';

/* ---------------------------------------------------
   Generic Helpers (new + legacy compatibility)
--------------------------------------------------- */

export const BASE = API_BASE; // ✅ legacy alias for older imports

/** Fetch with small retry; returns a Response (like native fetch). */
export const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retries = 2,
  delay = 500,
): Promise<Response> => {
  const retryable = new Set([408, 429, 500, 502, 503, 504]);
  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= retries) {
    try {
      const res = await fetch(url, { cache: 'no-store', ...options });
      if (!res.ok && retryable.has(res.status) && attempt < retries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, delay * Math.pow(2, attempt - 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt >= retries) break;
      attempt += 1;
      await new Promise((r) => setTimeout(r, delay * Math.pow(2, attempt - 1)));
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
};

/** Simple JSON fetch with consistent error handling */
export async function safeFetch<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetchWithRetry(url, opts);
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`[API ${res.status}] ${msg || res.statusText}`);
  }
  return (await res.json()) as T;
}

/** ✅ Legacy POST helper */
export async function apiPost<T = any>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`[POST ${res.status}] ${msg}`);
  }
  return (await res.json()) as T;
}

/* ---------------------------------------------------
   Property Listings
--------------------------------------------------- */

export type ListParams = {
  q?: string;
  min?: number;
  max?: number;
  beds?: number;
  sort?:
    | 'created_at_desc'
    | 'price_asc'
    | 'price_desc'
    | 'yield_desc'
    | 'roi_desc'
    | 'score_desc'
    // legacy
    | 'created_at'
    | 'price'
    | 'bedrooms'
    | 'score'
    | 'roi_percent'
    | 'yield_percent';
  dir?: 'asc' | 'desc'; // legacy
  limit?: number;
  offset?: number;
};

export type PropertyRow = {
  id: string;
  title: string;
  location: string;
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  yield_percent?: number;
  roi_percent?: number;
  score?: number;
  imageurl?: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
};

export type PropertiesPage = {
  items: PropertyRow[];
  total: number;
  mappable_count?: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

export async function listPropertiesPage(params: ListParams = {}): Promise<PropertiesPage> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.min) sp.set('min', String(params.min));
  if (params.max) sp.set('max', String(params.max));
  if (params.beds) sp.set('beds', String(params.beds));
  if (params.sort) sp.set('sort', params.sort);
  if (params.dir) sp.set('dir', params.dir);
  if (params.limit) sp.set('limit', String(params.limit));
  if (typeof params.offset === 'number') sp.set('offset', String(params.offset));

  const data = await safeFetch<any>(`${API_BASE}/properties?${sp.toString()}`);
  if (Array.isArray(data)) {
    return {
      items: data as PropertyRow[],
      total: data.length,
      limit: params.limit ?? data.length,
      offset: params.offset ?? 0,
      has_more: false,
    };
  }
  return {
    items: (data?.items ?? []) as PropertyRow[],
    total: typeof data?.total === 'number' ? data.total : 0,
    limit: typeof data?.limit === 'number' ? data.limit : params.limit ?? 50,
    offset: typeof data?.offset === 'number' ? data.offset : params.offset ?? 0,
    has_more: Boolean(data?.has_more),
  };
}

export async function listProperties(params: ListParams = {}): Promise<PropertyRow[]> {
  const page = await listPropertiesPage(params);
  return page.items;
}

/* ---------------------------------------------------
   Stripe Endpoints
--------------------------------------------------- */

export async function createCheckoutSession(planId: string, email: string) {
  return apiPost('/stripe/create-checkout-session', { plan_id: planId, email });
}

export async function createPortalSession(email: string) {
  return apiPost('/stripe/create-portal-session', { email });
}

/* ---------------------------------------------------
   Magic Link Authentication
--------------------------------------------------- */

export async function sendMagicLink(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/send-magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, message: text || 'Magic link error' };
    }
    return { success: true, message: 'Magic link sent' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error' };
  }
}

/* ---------------------------------------------------
   AI Features (compatibility)
--------------------------------------------------- */

export async function postAiSummary(data: any) {
  return apiPost('/ai/summary', data);
}

export async function postAiStrategies(data: any) {
  return apiPost('/ai/strategies', data);
}

/* ---------------------------------------------------
   Healthcheck
--------------------------------------------------- */

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------
   Sprint 11: AI Chat, Scoring, Area Intel & Comps
--------------------------------------------------- */

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIChatRequest {
  messages: AIChatMessage[];
  context?: {
    property_id?: string;
    summary?: string;
    area_key?: string;
    postcode?: string;
  };
}

export interface AIChatResponse {
  ok: boolean;
  reply: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export interface AIScoreResponse {
  ok: boolean;
  score: number;
  categories: {
    yield: number;
    roi: number;
    price_to_rent: number;
    area_demand: number;
    crime_index_inverse: number;
    schools_access: number;
  };
  version: string;
}

export interface AIScoreExplainRequest {
  score: number;
  property: Record<string, any>;
}

export interface AIScoreExplainResponse {
  ok: boolean;
  explanation: string;
  bullets: string[];
}

export async function postAIChat(body: AIChatRequest): Promise<AIChatResponse> {
  return apiPost('/gpt/chat', body);
}

export async function postAIScore(body: Record<string, any>): Promise<AIScoreResponse> {
  return apiPost('/gpt/score', body);
}

export async function postAIScoreExplain(body: AIScoreExplainRequest): Promise<AIScoreExplainResponse> {
  return apiPost('/gpt/score/explain', body);
}

export async function getAreaIntel(key: string) {
  return safeFetch(`${API_BASE}/area-intel/${encodeURIComponent(key)}`);
}

export async function getComps(postcode: string) {
  return safeFetch(`${API_BASE}/comps/${encodeURIComponent(postcode)}`);
}
