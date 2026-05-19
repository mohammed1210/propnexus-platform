/** @jest-environment node */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { buildAuthDebugPayload } from '@/lib/authDebug';

jest.mock('@/lib/authDebug', () => ({
  buildAuthDebugPayload: jest.fn(),
}));

const mockBuildAuthDebugPayload = buildAuthDebugPayload as jest.MockedFunction<typeof buildAuthDebugPayload>;

const safePayload = {
  disableAuthRaw: 'false',
  disableAuthParsed: false,
  isAuthEnabled: true,
  isAuthEnabledClient: true,
  vercelEnv: 'production',
  commitSha: 'abc123def456',
  clerk: {
    hasPublishableKey: true,
    hasValidPublishableKey: true,
    publishableKeyHasWhitespace: false,
    hasSecretKey: true,
    hasSignInUrl: true,
    hasSignUpUrl: true,
    hasAfterSignInUrl: true,
    hasAfterSignUpUrl: true,
  },
  whoami: {
    hasUserId: true,
    hasSessionId: true,
    hasEmail: true,
  },
};

describe('/api/admin/auth-status', () => {
  beforeEach(() => {
    mockBuildAuthDebugPayload.mockReset();
  });

  it('is node/dynamic and returns the safe auth debug payload', async () => {
    mockBuildAuthDebugPayload.mockResolvedValue(safePayload);

    const route = await import('@/app/api/admin/auth-status/route');
    const res = await route.GET();
    const json = await res.json();

    expect(route.runtime).toBe('nodejs');
    expect(route.dynamic).toBe('force-dynamic');
    expect(mockBuildAuthDebugPayload).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(json).toEqual(safePayload);
    expect(JSON.stringify(json)).not.toContain('sk_');
    expect(JSON.stringify(json)).not.toContain('@');
  });
});
