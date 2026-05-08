/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('/api/insights/[pc]', () => {
  const oldEnv = process.env;
  const oldFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...oldEnv,
      NEXT_PUBLIC_BACKEND_URL: 'https://backend.example',
      BACKEND_URL: '',
      NEXT_PUBLIC_API_BASE: '',
      NEXT_PUBLIC_API_URL: '',
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/area-intel/')) {
        return new Response(JSON.stringify({ source: 'partial_live', avg_price: 350000 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/comps/')) {
        return new Response(JSON.stringify({ source: 'partial_live', sales: [{ price: 340000 }], rents: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    }) as any;
    jest.resetModules();
  });

  afterEach(() => {
    process.env = oldEnv;
    global.fetch = oldFetch;
  });

  it('accepts promised Next route params and aggregates backend insights', async () => {
    const { GET } = await import('@/app/api/insights/[pc]/route');
    const request = new Request('https://frontend.example/api/insights/IG1?area=1&comps=1');
    const res = await GET(request, { params: Promise.resolve({ pc: 'IG1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      postcode: 'IG1',
      area: { source: 'partial_live', avg_price: 350000 },
      comps: { source: 'partial_live', sales: [{ price: 340000 }], rents: [] },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://backend.example/area-intel/IG1',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://backend.example/comps/IG1',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });
});
