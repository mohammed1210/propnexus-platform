// frontend/lib/ai.ts
import { BASE } from "./api";

/**
 * Minimal shape we need from a property-like object to talk to the backend.
 * Map your domain fields into these before calling the helpers below.
 */
export type PropertyForAI = {
  id?: string;
  title?: string | null;
  address?: string | null;        // many cards use this for display
  location?: string | null;       // postcode/town/city if available
  price?: number | string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  yield_percent?: number | string | null;
  roi_percent?: number | string | null;
  propertyType?: string | null;
  investmentType?: string | null;
  description?: string | null;
};

type SummaryResponse = { summary: string; bullets: string[] };
type StrategiesResponse = { strategies: any[] };

/** Coerce possibly-formatted number input to a finite number, or return undefined. */
function coerceNumber(n: unknown): number | undefined {
  if (n === null || n === undefined || n === "") return undefined;
  const out =
    typeof n === "string" ? Number(n.replace(/[^\d.-]/g, "")) : Number(n);
  return Number.isFinite(out) ? out : undefined;
}

/**
 * Build the body expected by POST /ai/summary.
 * Ensures required `title` exists and avoids sending misleading zeros.
 */
function buildSummaryBody(p: PropertyForAI) {
  const title =
    (p.title && p.title.trim()) ||
    (p.address && p.address.trim()) ||
    "Property";

  return {
    title,
    location: (p.location ?? p.address ?? "").toString(),
    price: coerceNumber(p.price),
    bedrooms: coerceNumber(p.bedrooms),
    bathrooms: coerceNumber(p.bathrooms),
    yield_percent: coerceNumber(p.yield_percent),
    roi_percent: coerceNumber(p.roi_percent),
    propertyType: p.propertyType ?? undefined,
    investmentType: p.investmentType ?? undefined,
    description: p.description ?? undefined,
  };
}

/** Fetch wrapper that throws a helpful error message with backend details. */
async function requestJSON<T>(url: string, init: RequestInit): Promise<T> {
  if (!BASE) {
    throw new Error(
      "[ai] BASE URL is empty. Set NEXT_PUBLIC_API_BASE (or legacy NEXT_PUBLIC_BACKEND_URL / NEXT_PUBLIC_API_URL)."
    );
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      /* ignore JSON parse errors */
    }
    const suffix = detail ? ` — ${JSON.stringify(detail)}` : ` — ${res.statusText}`;
    throw new Error(`${init.method ?? "GET"} ${url} failed (${res.status})${suffix}`);
  }
  return res.json() as Promise<T>;
}

/** Call POST /ai/summary with a normalized payload. */
export async function getAISummary(p: PropertyForAI): Promise<SummaryResponse> {
  const body = buildSummaryBody(p);
  return requestJSON<SummaryResponse>(`${BASE}/ai/summary`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Call POST /ai/strategies with a normalized payload (and optional constraints). */
export async function getAIStrategies(
  p: PropertyForAI,
  constraints?: Record<string, unknown>
): Promise<StrategiesResponse> {
  const property = buildSummaryBody(p);
  return requestJSON<StrategiesResponse>(`${BASE}/ai/strategies`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ property, constraints }),
  });
}
