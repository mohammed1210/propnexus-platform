// Fetch area intelligence from backend and derive simple 0–100 scores.

export type AreaIntel = {
  avgYieldPct: number;
  avgRent: number;
  crimeRateIndex: number;
  ofstedSummary: string;
  transportSummary: string;
  demandIndex?: number;     // 0–100 derived
  transportScore?: number;  // 0–100 derived
  schoolsScore?: number;    // 0–100 derived
};

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

export async function fetchAreaIntel(postcode: string): Promise<AreaIntel> {
  if (!API) throw new Error('Missing NEXT_PUBLIC_BACKEND_URL');
  const pc = postcode.replace(/\s+/g, '');
  const res = await fetch(`${API}/area-intel/${encodeURIComponent(pc)}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Area intel failed: ${res.status}`);
  const data = (await res.json()) as AreaIntel;

  // naive derivations for demo:
  const demandIndex = Math.max(0, Math.min(100, Math.round(100 - (data.crimeRateIndex ?? 50))));
  const transportScore = 75;
  const schoolsScore = data.ofstedSummary?.toLowerCase().includes('good') ? 70 : 55;

  return { ...data, demandIndex, transportScore, schoolsScore };
}