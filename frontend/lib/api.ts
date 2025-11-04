// frontend/lib/api.ts
'use client';

export const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://propnexus-backend-production.up.railway.app';

/* ---------------------------------------------------
   Generic Helpers (new + legacy compatibility)
--------------------------------------------------- */

/** Simple fetch with consistent error handling */
export async function safeFetch<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...opts });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`[API ${res.status}] ${msg || res.statusText}`);
  }
  return (await res.json()) as T;
}

/** ✅ Legacy alias for safeFetch (keeps older components working) */
export const fetchWithRetry = async <T = any>(
  url: string,
  options: RequestInit = {},
  retries = 2,
  delay = 500
): Promise<T> => {
  try {
    return await safeFetch<T>(url, options);
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw err;
  }
};

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
  sort?: 'created_at' | 'price' | 'bedrooms' | 'roi_percent' | 'yield_percent';
  dir?: 'asc' | 'desc';
  limit?: number;
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
  imageurl?: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
};

export async function listProperties(params: ListParams = {}): Promise<PropertyRow[]> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.min) sp.set('min', String(params.min));
  if (params.max) sp.set('max', String(params.max));
  if (params.beds) sp.set('beds', String(params.beds));
  if (params.sort) sp.set('sort', params.sort);
  if (params.dir) sp.set('dir', params.dir);
  if (params.limit) sp.set('limit', String(params.limit));

  return safeFetch<PropertyRow[]>(`${API_BASE}/properties?${sp.toString()}`);
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
  return apiPost('/ai/generate-summary', data);
}

export async function postAiStrategies(data: any) {
  return apiPost('/ai/generate-strategies', data);
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
