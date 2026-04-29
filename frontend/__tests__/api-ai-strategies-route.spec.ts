/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('/api/ai/strategies proxy', () => {
  const oldFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    global.fetch = oldFetch;
  });

  it('proxies strategy requests to the backend and returns JSON response', async () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://backend.example';

    const fetchMock = jest.fn(async (url: any, init: any) => {
      expect(String(url)).toBe('https://backend.example/ai/strategies');
      const headers = init?.headers as Record<string, string>;
      expect(headers['x-forwarded-for']).toBeUndefined();
      expect(headers['x-real-ip']).toBeUndefined();
      expect(headers['cf-connecting-ip']).toBeUndefined();
      expect(headers['true-client-ip']).toBeUndefined();
      expect(headers['Content-Type']).toBe('application/json');

      return new Response(JSON.stringify({ strategies: [{ title: 'Refinance', rationale: 'Stabilise income.', steps: ['Let property'], risk: null }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    global.fetch = fetchMock as any;

    const { POST } = await import('@/app/api/ai/strategies/route');
    const req = new Request('http://localhost/api/ai/strategies', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.10',
        'x-real-ip': '203.0.113.11',
        'cf-connecting-ip': '203.0.113.12',
        'true-client-ip': '203.0.113.13',
      },
      body: JSON.stringify({ property: { title: 'Deal', location: 'London' }, constraints: {} }),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(body).toEqual({ strategies: [{ title: 'Refinance', rationale: 'Stabilise income.', steps: ['Let property'], risk: null }] });
  });

  it('returns safe JSON when upstream fails', async () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://backend.example';

    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ detail: 'AI strategies error' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const { POST } = await import('@/app/api/ai/strategies/route');
    const req = new Request('http://localhost/api/ai/strategies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ property: { title: 'Deal', location: 'London' }, constraints: {} }),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toEqual({ detail: 'AI strategies error' });
  });
});
