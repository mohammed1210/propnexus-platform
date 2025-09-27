// frontend/lib/ai.ts
export function getBackendBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    '';
  if (!raw) throw new Error('NEXT_PUBLIC_BACKEND_URL is not set');
  return raw.replace(/\/+$/, '');
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${resp.statusText} — ${txt}`);
  }
  return resp.json() as Promise<T>;
}

export type SummaryRequest = {
  title: string;
  location: string;
  price?: number;
  yield?: number;
  roi?: number;
  description?: string;
};

export type SummaryResponse = {
  summary: string;
  bullets: string[];
};

export type StrategiesRequest = {
  property: Record<string, string | number | null | undefined>;
  constraints?: Record<string, string | number | boolean>;
};

export type Strategy = {
  title: string;
  rationale: string;
  steps: string[];
  risk?: string | null;
};

export type StrategiesResponse = { strategies: Strategy[] };

export async function fetchSummary(body: SummaryRequest) {
  return postJSON<SummaryResponse>(`${getBackendBase()}/ai/summary`, body);
}

export async function fetchStrategies(body: StrategiesRequest) {
  return postJSON<StrategiesResponse>(`${getBackendBase()}/ai/strategies`, body);
}
