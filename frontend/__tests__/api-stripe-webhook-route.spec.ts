/** @jest-environment node */

import { describe, expect, it } from '@jest/globals';

describe('/api/stripe/webhook', () => {
  it('returns 410 for GET and documents backend ownership', async () => {
    const { GET } = await import('@/app/api/stripe/webhook/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(410);
    expect(body).toEqual({
      ok: false,
      detail:
        'Stripe webhook ownership lives on the backend /stripe/webhook route. This frontend route is disabled.',
    });
  });

  it('returns 410 for POST and does not process webhook payloads', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route');
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(410);
    expect(body.ok).toBe(false);
    expect(body.detail).toContain('backend /stripe/webhook');
  });
});
