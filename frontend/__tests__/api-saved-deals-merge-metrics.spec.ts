/** @jest-environment node */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'user_test_123' }),
}));

describe('/api/saved-deals merges snapshot metrics', () => {
  const oldEnv = process.env;
  const oldFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...oldEnv };
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://backend.example';

    global.fetch = jest.fn(async (input: any) => {
      const url = String(typeof input === 'string' ? input : input?.url);

      if (url.includes('/saved-deals')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'deal1',
                property_id: 'prop1',
                saved_at: '2026-01-01T00:00:00Z',
                data: { rent_monthly: 1500, yield_percent: 7.2, roi_percent: 9.1 },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      if (url.includes('/properties/prop1')) {
        // Property payload missing metrics; should be filled from saved deal snapshot.
        return new Response(JSON.stringify({ id: 'prop1', price: 250000 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      return new Response('not found', { status: 404 });
    }) as any;
  });

  afterEach(() => {
    process.env = oldEnv;
    global.fetch = oldFetch;
    jest.resetModules();
  });

  it('backfills rent/yield/roi into returned property', async () => {
    const { GET } = await import('@/app/api/saved-deals/route');

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(Array.isArray(json.deals)).toBe(true);
    expect(json.deals[0].property).toMatchObject({
      id: 'prop1',
      price: 250000,
      rent_monthly: 1500,
      yield_percent: 7.2,
      roi_percent: 9.1,
    });
  });
});
