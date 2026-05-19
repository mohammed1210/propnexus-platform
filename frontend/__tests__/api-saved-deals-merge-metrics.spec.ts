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
    process.env.PROPNEXUS_INTERNAL_API_TOKEN = 'test-internal-token';

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
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://backend.example/saved-deals'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-PropNexus-Internal-Token': 'test-internal-token',
          'x-propnexus-user-id': 'user_test_123',
        }),
      }),
    );
  });

  it('returns exact saved check without enriching every saved deal', async () => {
    global.fetch = jest.fn(async (input: any) => {
      const url = String(typeof input === 'string' ? input : input?.url);

      if (url.includes('/saved-deals')) {
        return new Response(
          JSON.stringify({
            data: [
              { id: 'deal1', property_id: 'prop1', saved_at: '2026-01-01T00:00:00Z' },
              { id: 'deal2', property_id: 'prop2', saved_at: '2026-01-02T00:00:00Z' },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      return new Response('unexpected enrichment', { status: 500 });
    }) as any;

    const { GET } = await import('@/app/api/saved-deals/route');

    const res = await GET(new Request('http://localhost/api/saved-deals?property_id=prop2'));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.saved).toBe(true);
    expect(json.deals).toHaveLength(1);
    expect(json.deals[0]).toMatchObject({ property_id: 'prop2', property: null });
    expect((global.fetch as jest.Mock).mock.calls.some(([url]) => String(url).includes('/properties/'))).toBe(false);
  });

  it('returns a safe unavailable response when the internal API token is missing', async () => {
    delete process.env.PROPNEXUS_INTERNAL_API_TOKEN;
    global.fetch = jest.fn() as any;

    const { GET } = await import('@/app/api/saved-deals/route');

    const res = await GET(new Request('http://localhost/api/saved-deals'));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json).toEqual({
      error: 'server_configuration',
      message: 'Saved deals are temporarily unavailable. Please try again shortly.',
    });
    expect(JSON.stringify(json)).not.toContain('PROPNEXUS_INTERNAL_API_TOKEN');
    expect(JSON.stringify(json)).not.toContain('token');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
