// frontend/lib/api.ts
function computeBase(): string {
  // Highest → lowest precedence (compatible with your existing configs)
  const raw =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';

  // In development only, allow localhost fallback
  if (!raw) {
    if (process.env.NODE_ENV !== 'production') {
      return 'http://127.0.0.1:8000';
    }
    // In production, never use localhost. Force a hard error so we notice.
    throw new Error('API base URL is not configured (set NEXT_PUBLIC_API_BASE or NEXT_PUBLIC_BACKEND_URL)');
  }

  return raw.replace(/\/+$/, '');
}

const API_BASE = computeBase();

export type SummaryRequest = {
  title: string;
  location: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  yield_percent?: number;
  roi_percent?: number;
  propertyType?: string;
  investmentType?: string;
  description?: string;
};

export type SummaryResponse = { summary: string; bullets: string[] };

export type StrategiesRequest = {
  property: Record<string, unknown>;
  constraints?: Record<string, unknown>;
};

export type Strategy = { title: string; rationale?: string; steps?: string[]; risk?: string | null };
export type StrategiesResponse = { strategies: Strategy[] };

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function postAiSummary(body: SummaryRequest) {
  const res = await fetch(`${API_BASE}/ai/summary`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return j<SummaryResponse>(res);
}

export async function postAiStrategies(body: StrategiesRequest) {
  const res = await fetch(`${API_BASE}/ai/strategies`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return j<StrategiesResponse>(res);
}

export { API_BASE };
