/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('postAiSummary', () => {
  const oldFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    global.fetch = oldFetch;
  });

  it('uses same-origin /api/ai/summary path and returns JSON on success', async () => {
    global.fetch = jest.fn(async (input: any) => {
      expect(String(input)).toBe('/api/ai/summary');
      return new Response(JSON.stringify({ summary: 'OK', bullets: ['One'] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const { postAiSummary } = await import('@/lib/api');
    const data = await postAiSummary({ title: 'Deal', location: 'London' });

    expect(data).toEqual({ summary: 'OK', bullets: ['One'] });
  });

  it('throws a normalized error when proxy returns backend failure JSON', async () => {
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ detail: 'AI summary error' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const { postAiSummary } = await import('@/lib/api');

    await expect(postAiSummary({ title: 'Deal', location: 'London' })).rejects.toThrow(
      '[POST 502] AI summary error',
    );
  });
});
