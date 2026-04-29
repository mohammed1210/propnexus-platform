/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('postAiStrategies', () => {
  const oldFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    global.fetch = oldFetch;
  });

  it('uses same-origin /api/ai/strategies path and returns JSON on success', async () => {
    global.fetch = jest.fn(async (input: any) => {
      expect(String(input)).toBe('/api/ai/strategies');
      return new Response(JSON.stringify({ strategies: [{ title: 'Hold', rationale: 'Income.', steps: ['Let it'], risk: null }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const { postAiStrategies } = await import('@/lib/api');
    const data = await postAiStrategies({ property: { title: 'Deal', location: 'London' }, constraints: {} });

    expect(data).toEqual({ strategies: [{ title: 'Hold', rationale: 'Income.', steps: ['Let it'], risk: null }] });
  });

  it('throws a normalized error when proxy returns backend failure JSON', async () => {
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ detail: 'AI strategies error' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const { postAiStrategies } = await import('@/lib/api');

    await expect(postAiStrategies({ property: { title: 'Deal', location: 'London' }, constraints: {} })).rejects.toThrow(
      '[POST 502] AI strategies error',
    );
  });
});
