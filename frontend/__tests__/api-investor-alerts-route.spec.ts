/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

let mockUserId: string | null = null;
let mockBackendFetch: jest.Mock;

jest.mock('@/lib/server/propertyData', () => ({
  getOptionalClerkUserId: async () => mockUserId,
  backendFetch: (...args: any[]) => mockBackendFetch(...args),
}));

describe('/api/investor-alerts', () => {
  beforeEach(() => {
    mockUserId = null;
    mockBackendFetch = jest.fn();
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns a clear 401 before proxying when the user is not signed in', async () => {
    const { POST } = await import('@/app/api/investor-alerts/route');

    const res = await POST(
      new Request('http://localhost/api/investor-alerts', {
        method: 'POST',
        body: JSON.stringify({ label: 'Deal alert' }),
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: 'unauthorized',
      message: 'Please sign in to create deal alerts.',
    });
    expect(mockBackendFetch).not.toHaveBeenCalled();
  });

  it('forwards authenticated create requests with the Clerk user header', async () => {
    mockUserId = 'user_test_123';
    mockBackendFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, alert: { id: 'alert_1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { POST } = await import('@/app/api/investor-alerts/route');
    const body = { label: 'Deal alert', include_tiers: ['prime', 'strong'] };
    const res = await POST(
      new Request('http://localhost/api/investor-alerts', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, alert: { id: 'alert_1' } });
    expect(mockBackendFetch).toHaveBeenCalledWith(
      '/investor-alerts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-clerk-user-id': 'user_test_123',
        }),
      }),
    );
  });

  it('returns backend text errors as JSON for useful UI messages', async () => {
    mockUserId = 'user_test_123';
    mockBackendFetch.mockResolvedValue(new Response('relation "investor_alerts" does not exist', { status: 500 }));

    const { POST } = await import('@/app/api/investor-alerts/route');
    const res = await POST(
      new Request('http://localhost/api/investor-alerts', {
        method: 'POST',
        body: JSON.stringify({ label: 'Deal alert' }),
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'backend_error',
      message: 'relation "investor_alerts" does not exist',
    });
  });
});
