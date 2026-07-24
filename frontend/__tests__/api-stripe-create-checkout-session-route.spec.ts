/** @jest-environment node */

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

describe('/api/stripe/create-checkout-session', () => {
  const oldEnv = process.env;
  const oldFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...oldEnv,
      NEXT_PUBLIC_BACKEND_URL: 'https://backend.example',
      PROPNEXUS_INTERNAL_API_TOKEN: 'test-internal-token',
      NEXT_PUBLIC_DISABLE_AUTH: 'true',
    };
    mockAuth.mockReset();
    mockGetUser.mockReset();
    jest.resetModules();
  });

  afterEach(() => {
    process.env = oldEnv;
    global.fetch = oldFetch;
  });

  it('proxies checkout session creation to the backend without exposing secrets', async () => {
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/session_123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const { POST } = await import('@/app/api/stripe/create-checkout-session/route');
    const res = await POST(
      new Request('http://localhost/api/stripe/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ price_id: 'price_test_123', email: 'user@example.com' }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ url: 'https://checkout.stripe.com/c/session_123' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://backend.example/stripe/create-checkout-session',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-PropNexus-Internal-Token': 'test-internal-token',
          'x-propnexus-user-email': 'user@example.com',
        }),
      }),
    );
    expect(JSON.stringify(body)).not.toContain('test-internal-token');
  });
});
