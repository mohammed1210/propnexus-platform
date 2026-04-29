/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('postAIChat', () => {
  const oldFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    global.fetch = oldFetch;
  });

  it('uses same-origin /api/gpt/chat path and returns JSON on success', async () => {
    global.fetch = jest.fn(async (input: any) => {
      expect(String(input)).toBe('/api/gpt/chat');
      return new Response(
        JSON.stringify({ ok: true, reply: 'Looks promising.', usage: { prompt_tokens: 0, completion_tokens: 0 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as any;

    const { postAIChat } = await import('@/lib/api');
    const data = await postAIChat({
      messages: [{ role: 'user', content: 'Is this good?' }],
      context: { property_id: '123' },
    });

    expect(data).toEqual({ ok: true, reply: 'Looks promising.', usage: { prompt_tokens: 0, completion_tokens: 0 } });
  });

  it('throws a normalized error when proxy returns backend failure JSON', async () => {
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ detail: 'AI chat error' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const { postAIChat } = await import('@/lib/api');

    await expect(postAIChat({ messages: [{ role: 'user', content: 'Hello' }] })).rejects.toThrow(
      '[POST 502] AI chat error',
    );
  });
});
