/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockAuth = jest.fn();
const mockGetUser = jest.fn();

const mockPortalCreate = jest.fn();
const mockCustomerSearch = jest.fn();

jest.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
  clerkClient: async () => ({
    users: {
      getUser: mockGetUser,
    },
  }),
}));

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    billingPortal: {
      sessions: {
        create: mockPortalCreate,
      },
    },
    customers: {
      search: mockCustomerSearch,
    },
  }));
});

describe('/api/stripe/portal', () => {
  const oldEnv = process.env;
  const oldFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...oldEnv,
      STRIPE_SECRET_KEY: 'sk_test_123',
      NEXT_PUBLIC_BACKEND_URL: 'https://backend.example',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_123',
      CLERK_SECRET_KEY: 'sk_clerk_123',
      NEXT_PUBLIC_DISABLE_AUTH: 'false',
    };

    mockAuth.mockReset();
    mockGetUser.mockReset();
    mockPortalCreate.mockReset();
    mockCustomerSearch.mockReset();
    jest.resetModules();
  });

  afterEach(() => {
    process.env = oldEnv;
    global.fetch = oldFetch;
  });

  it('returns billing portal URL for an authenticated mapped user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    mockGetUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: 'mapped@example.com' },
      emailAddresses: [{ emailAddress: 'mapped@example.com' }],
    });
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ plan: 'pro', stripe_customer_id: 'cus_mapped_123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;
    mockPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/p/session_123' });

    const { POST } = await import('@/app/api/stripe/portal/route');
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, url: 'https://billing.stripe.com/p/session_123' });
    expect(mockCustomerSearch).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://backend.example/users/plan?email=mapped%40example.com',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      }),
    );
    expect(mockPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_mapped_123',
        return_url: 'http://localhost:3000/account',
      }),
    );
  });

  it('returns safe 404 when authenticated user has no mapped Stripe customer', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_2' });
    mockGetUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: 'nomap@example.com' },
      emailAddresses: [{ emailAddress: 'nomap@example.com' }],
    });
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ plan: 'free', stripe_customer_id: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;
    mockCustomerSearch.mockResolvedValue({ data: [] });

    const { POST } = await import('@/app/api/stripe/portal/route');
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ ok: false, error: 'No billing account found for your signed-in user.' });
  });

  it('rejects unauthenticated requests', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    global.fetch = jest.fn() as any;

    const { POST } = await import('@/app/api/stripe/portal/route');
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ ok: false, error: 'You must be signed in to manage billing.' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns safe error when Stripe is not configured', async () => {
    process.env = {
      ...process.env,
      STRIPE_SECRET_KEY: '',
    };

    mockAuth.mockResolvedValue({ userId: 'user_3' });
    mockGetUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: 'configured@example.com' },
      emailAddresses: [{ emailAddress: 'configured@example.com' }],
    });

    const { POST } = await import('@/app/api/stripe/portal/route');
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ ok: false, error: 'Billing portal is not configured right now.' });
  });
});
