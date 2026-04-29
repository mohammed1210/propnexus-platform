/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('/api/gpt/chat proxy', () => {
  const oldFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    global.fetch = oldFetch;
  });

  it('proxies chat requests to the backend and returns JSON response', async () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://backend.example';

    const fetchMock = jest.fn(async (url: any, init: any) => {
      expect(String(url)).toBe('https://backend.example/gpt/chat');
      const headers = init?.headers as Record<string, string>;
      expect(headers['x-forwarded-for']).toBeUndefined();
      expect(headers['x-real-ip']).toBeUndefined();
      expect(headers['cf-connecting-ip']).toBeUndefined();
      expect(headers['true-client-ip']).toBeUndefined();
      expect(headers['Content-Type']).toBe('application/json');

      return new Response(
        JSON.stringify({ ok: true, reply: 'This deal has a strong yield.', usage: { prompt_tokens: 0, completion_tokens: 0 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    global.fetch = fetchMock as any;

    const { POST } = await import('@/app/api/gpt/chat/route');
    const req = new Request('http://localhost/api/gpt/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.10',
        'x-real-ip': '203.0.113.11',
        'cf-connecting-ip': '203.0.113.12',
        'true-client-ip': '203.0.113.13',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Is this a good investment?' }],
        context: { property_id: '123', summary: 'Test deal' },
      }),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, reply: 'This deal has a strong yield.', usage: { prompt_tokens: 0, completion_tokens: 0 } });
  });

  it('returns safe JSON when upstream fails', async () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://backend.example';

    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ detail: { ai_disabled: true } }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const { POST } = await import('@/app/api/gpt/chat/route');
    const req = new Request('http://localhost/api/gpt/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toEqual({ detail: { ai_disabled: true } });
  });
});
