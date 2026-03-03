"use client";

import { API_BASE } from '@/lib/api';

const FALLBACK_QUERY_ID = '00000000-0000-4000-8000-000000000000';

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'propnexus.search.session_id';
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;

  let next = FALLBACK_QUERY_ID;
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      next = crypto.randomUUID();
    }
  } catch {
    next = FALLBACK_QUERY_ID;
  }
  window.sessionStorage.setItem(key, next);
  return next;
}

export async function track(eventName: string, payload: Record<string, unknown>): Promise<void> {
  if (eventName !== 'search_click') return;

  try {
    const queryText = String(payload.queryText ?? '').trim();
    const sessionId = getSessionId();

    await fetch(`${API_BASE}/events/search_click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: queryText,
        property_id: payload.listingId,
        position: payload.rank,
        filters_json: payload.filters ?? {},
        session_id: sessionId,
        query_id: payload.queryId ?? FALLBACK_QUERY_ID,
        listing_id: payload.listingId,
        rank: payload.rank ?? payload.position,
        user_id: payload.userId,
      }),
      keepalive: true,
    });
  } catch {
    // best-effort analytics event
  }
}
