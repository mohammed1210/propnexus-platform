export type SavedDeal = {
  id: string;
  property_id?: string | null;
  title?: string | null;
  location?: string | null;
  postcode?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
  investment_type?: string | null;
  property_type?: string | null;
  score?: number | null;
  ai_score?: number | null;
  score_breakdown?: unknown;
  saved_at?: string | null;
  created_at?: string | null;
};

type SavedDealsResponse = { data?: SavedDeal[] } | SavedDeal[];

function buildHeaders(userId?: string | null): HeadersInit {
  const h: Record<string, string> = {};
  if (userId) h['x-clerk-user-id'] = userId;
  return h;
}

export async function fetchSavedDeals(args: { userId?: string | null; signal?: AbortSignal } = {}) {
  const res = await fetch('/api/saved-deals', {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
    headers: buildHeaders(args.userId),
    signal: args.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(text || `Failed to load saved deals (${res.status})`);
    (err as any).status = res.status;
    throw err;
  }

  const json: SavedDealsResponse = await res.json().catch(() => []);
  const items = Array.isArray(json) ? json : Array.isArray((json as any)?.data) ? (json as any).data : [];
  return items as SavedDeal[];
}

export async function removeSavedDealByPropertyId(args: { propertyId: string; userId?: string | null }) {
  const res = await fetch(`/api/saved-deals/${encodeURIComponent(args.propertyId)}`, {
    method: 'DELETE',
    headers: buildHeaders(args.userId),
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(text || `Remove failed (${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
}

export async function clearSavedDeals(args: { userId?: string | null }) {
  const res = await fetch('/api/saved-deals/clear', {
    method: 'POST',
    headers: buildHeaders(args.userId),
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(text || `Clear failed (${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
}
