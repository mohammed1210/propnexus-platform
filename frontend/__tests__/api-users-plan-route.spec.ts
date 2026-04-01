/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockAuth = jest.fn();
const mockGetUser = jest.fn();

jest.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
  clerkClient: async () => ({
    users: {
      getUser: mockGetUser,
    },
  }),
}));

describe('/api/users/plan', () => {
  const oldEnv = process.env;
  const oldFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...oldEnv,
      NEXT_PUBLIC_BACKEND_URL: 'https://backend.example',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_123',
      CLERK_SECRET_KEY: 'sk_clerk_123',
      NEXT_PUBLIC_DISABLE_AUTH: 'false',
    };

    mockAuth.mockReset();
    mockGetUser.mockReset();
    jest.resetModules();
  });

  afterEach(() => {
    process.env = oldEnv;
    global.fetch = oldFetch;
  });

  it('returns plan for valid upstream payload', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    mockGetUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: 'user@example.com' },
      emailAddresses: [{ emailAddress: 'user@example.com' }],
    });
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ plan: 'pro' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const { GET } = await import('@/app/api/users/plan/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ plan: 'pro' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://backend.example/users/plan?email=user%40example.com',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      }),
    );
  });

  it('does not expose stripe customer id to the browser payload', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    mockGetUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: 'user@example.com' },
      emailAddresses: [{ emailAddress: 'user@example.com' }],
    });
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ plan: 'investor', stripe_customer_id: 'cus_hidden' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const { GET } = await import('@/app/api/users/plan/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ plan: 'investor' });
    expect(body).not.toHaveProperty('stripe_customer_id');
  });

  it('rejects malformed upstream payload with 502', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_2' });
    mockGetUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: 'user2@example.com' },
      emailAddresses: [{ emailAddress: 'user2@example.com' }],
    });
    global.fetch = jest.fn(async () => {
      return new Response('not-json', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      });
    }) as any;

    const { GET } = await import('@/app/api/users/plan/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toEqual({ detail: 'Invalid plan response format' });
  });

  it('rejects missing plan field with 502', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_3' });
    mockGetUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: 'user3@example.com' },
      emailAddresses: [{ emailAddress: 'user3@example.com' }],
    });
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ stripe_customer_id: 'cus_123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const { GET } = await import('@/app/api/users/plan/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toEqual({ detail: 'Invalid plan response format' });
  });
});
