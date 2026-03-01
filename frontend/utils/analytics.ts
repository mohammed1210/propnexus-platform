'use client';

import { API_BASE } from '@/lib/api';

type EventPayload = Record<string, unknown>;

export async function track(eventName: string, payload: EventPayload): Promise<void> {
  try {
    if (eventName === 'filter_select') {
      await fetch(`${API_BASE}/events/filter_select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      return;
    }

    if (eventName === 'search_click') {
      await fetch(`${API_BASE}/events/search_click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }
  } catch {
    // best-effort analytics
  }
}
