"use client";

import { API_BASE } from '@/lib/api';

export async function track(eventName: string, payload: Record<string, unknown>): Promise<void> {
  if (eventName !== 'search_click') return;

  try {
    await fetch(`${API_BASE}/events/search_click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query_id: payload.queryId,
        listing_id: payload.listingId,
        rank: payload.rank,
        user_id: payload.userId,
      }),
    });
  } catch {
    // best-effort analytics event
  }
}
