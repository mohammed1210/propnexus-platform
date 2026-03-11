"use client";

import { API_BASE } from '@/lib/api';
import type { SearchClickPayload } from '@/contracts';

export const FALLBACK_QUERY_ID = '00000000-0000-4000-8000-000000000000';

export function generateQueryId(_seed?: string): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    return FALLBACK_QUERY_ID;
  }
  return FALLBACK_QUERY_ID;
}

export type SearchClickRequestBody = {
  query: string;
  query_id: string;
  listing_id: string;
  property_id: string;
  rank?: number;
  position?: number;
  session_id: string;
  filters_json: Record<string, unknown>;
  user_id?: string;
};

/**
 * Fire-and-forget helper for search result clicks.
 * This must never block navigation or throw into UI flows.
 */
export async function logSearchClick(body: SearchClickRequestBody): Promise<void> {
  try {
    await fetch(`${API_BASE}/events/search_click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // best-effort analytics event
  }
}

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
    const eventPayload: SearchClickPayload = {
      queryId: typeof payload.queryId === 'string' ? payload.queryId : FALLBACK_QUERY_ID,
      listingId: String(payload.listingId ?? ''),
      rank:
        typeof payload.rank === 'number'
          ? payload.rank
          : typeof payload.position === 'number'
            ? payload.position
            : undefined,
      queryText: String(payload.queryText ?? '').trim(),
      filters:
        payload.filters && typeof payload.filters === 'object'
          ? (payload.filters as Record<string, unknown>)
          : {},
      userId: typeof payload.userId === 'string' ? payload.userId : undefined,
    };
    if (!eventPayload.listingId) return;

    const sessionId = getSessionId();

    await logSearchClick({
        query: eventPayload.queryText ?? '',
        property_id: eventPayload.listingId,
        position: eventPayload.rank,
        filters_json: eventPayload.filters ?? {},
        session_id: sessionId,
        query_id: eventPayload.queryId,
        listing_id: eventPayload.listingId,
        rank: eventPayload.rank,
        user_id: eventPayload.userId,
    });
  } catch {
    // best-effort analytics event
  }
}
