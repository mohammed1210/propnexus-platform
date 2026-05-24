/** @jest-environment node */

describe('/api/stripe/checkout', () => {
  const oldEnv = process.env;
  const oldFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...oldEnv,
      NEXT_PUBLIC_BACKEND_URL: 'https://backend.example',
      PROPNEXUS_INTERNAL_API_TOKEN: 'test-internal-token',
    };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = oldEnv;
    global.fetch = oldFetch;
  });

  it('proxies checkout requests through the first successful backend checkout endpoint', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response('not-found', {
          status: 404,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ url: 'https://checkout.stripe.com/session_123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ) as any;

    const { POST } = await import('@/app/api/stripe/checkout/route');
    const res = await POST(
      new Request('http://localhost/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({ price_id: 'price_123', email: 'user@example.com' }),
        headers: { 'content-type': 'application/json' },
      }) as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ url: 'https://checkout.stripe.com/session_123' });
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://backend.example/stripe/checkout',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://backend.example/stripe/create-checkout-session',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-PropNexus-Internal-Token': 'test-internal-token',
        }),
      }),
    );
    expect(JSON.stringify(body)).not.toContain('test-internal-token');
  });

  it('returns 502 when no backend checkout endpoint exists', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response('not-found', { status: 404 }))
      .mockResolvedValueOnce(new Response('not-found', { status: 404 })) as any;

    const { POST } = await import('@/app/api/stripe/checkout/route');
    const res = await POST(
      new Request('http://localhost/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({ price_id: 'price_123' }),
        headers: { 'content-type': 'application/json' },
      }) as any,
    );
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toEqual({ error: 'No Stripe endpoint found on backend' });
  });
});
