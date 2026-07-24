/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockAuth = jest.fn();

jest.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

describe('/api/analyse', () => {
  const oldEnv = process.env;
  const oldFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...oldEnv,
      NEXT_PUBLIC_BACKEND_URL: 'https://backend.example',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_123',
      CLERK_SECRET_KEY: 'sk_test_123',
      NEXT_PUBLIC_DISABLE_AUTH: 'false',
      PROPNEXUS_INTERNAL_API_TOKEN: 'test-internal-token',
    };
    mockAuth.mockReset();
    jest.resetModules();
  });

  afterEach(() => {
    process.env = oldEnv;
    global.fetch = oldFetch;
  });

  it('rejects invalid price payloads before calling upstream', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    global.fetch = jest.fn() as any;

    const { POST } = await import('@/app/api/analyse/route');
    const response = await POST(
      new Request('http://localhost/api/analyse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Deal', location: 'Leeds', price: -10 }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation_error');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('creates a user_submitted property and stores the URL only as reference data', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_2' });
    global.fetch = jest.fn(async () => {
      return new Response(
        JSON.stringify({ ok: true, property_id: 'prop_123', property: { id: 'prop_123', source: 'user_submitted' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as any;

    const { POST } = await import('@/app/api/analyse/route');
    const response = await POST(
      new Request('http://localhost/api/analyse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: 'https://example.com/listing/123',
          title: 'Investor deal',
          location: 'Leeds',
          postcode: 'LS1 4AB',
          price: 250000,
          estimatedMonthlyRent: 1400,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.property_id).toBe('prop_123');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://backend.example/properties/user-submitted',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-PropNexus-Internal-Token': 'test-internal-token',
          'x-propnexus-user-id': 'user_2',
        }),
        body: expect.stringContaining('"source_url":"https://example.com/listing/123"'),
      }),
    );
    expect(global.fetch).not.toHaveBeenCalledWith('https://example.com/listing/123', expect.anything());
  });

  it('auto-creates a manual title when the user leaves it blank', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_3' });
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ ok: true, property_id: 'prop_999' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const { POST } = await import('@/app/api/analyse/route');
    await POST(
      new Request('http://localhost/api/analyse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          location: 'Leeds',
          postcode: 'LS1 4AB',
          price: 250000,
        }),
      }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://backend.example/properties/user-submitted',
      expect.objectContaining({
        body: expect.stringContaining('"title":"Manual deal — LS1 4AB"'),
      }),
    );
  });
});
