/**
 * Test API URL resolution logic across the frontend
 * Ensures consistent fallback chain: BACKEND_URL -> API_BASE -> API_URL -> production default
 */

describe('API URL Resolution', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('lib/api.ts - API_BASE constant', () => {
    it('should prioritize NEXT_PUBLIC_BACKEND_URL', () => {
      process.env.NEXT_PUBLIC_BACKEND_URL = 'https://backend.example.com';
      process.env.NEXT_PUBLIC_API_BASE = 'https://base.example.com';
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';

      jest.isolateModules(() => {
        const { API_BASE } = require('@/lib/api');
        expect(API_BASE).toBe('https://backend.example.com');
      });
    });

    it('should fallback to NEXT_PUBLIC_API_URL when BACKEND_URL is not set', () => {
      delete process.env.NEXT_PUBLIC_BACKEND_URL;
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';

      jest.isolateModules(() => {
        const { API_BASE } = require('@/lib/api');
        expect(API_BASE).toBe('https://api.example.com');
      });
    });

    it('should fallback to default Railway URL when no env vars are set', () => {
      delete process.env.NEXT_PUBLIC_BACKEND_URL;
      delete process.env.NEXT_PUBLIC_API_BASE;
      delete process.env.NEXT_PUBLIC_API_URL;

      jest.isolateModules(() => {
        const { API_BASE } = require('@/lib/api');
        expect(API_BASE).toBe('https://propnexus-backend-production.up.railway.app');
      });
    });

    it('should use API_BASE when only it is set', () => {
      delete process.env.NEXT_PUBLIC_BACKEND_URL;
      process.env.NEXT_PUBLIC_API_BASE = 'https://base.example.com';
      delete process.env.NEXT_PUBLIC_API_URL;

      jest.isolateModules(() => {
        const { API_BASE } = require('@/lib/api');
        expect(API_BASE).toBe('https://base.example.com');
      });
    });
  });

  describe('resolveApiBase helper (used by listings + client fetchers)', () => {
    const railwayDefault = 'https://propnexus-backend-production.up.railway.app';

    it('should resolve BACKEND_URL first', () => {
      process.env.NEXT_PUBLIC_BACKEND_URL = 'https://backend.example.com';
      process.env.NEXT_PUBLIC_API_BASE = 'https://base.example.com';
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';

      jest.isolateModules(() => {
        const { resolveApiBase } = require('@/lib/api');
        expect(resolveApiBase()).toBe('https://backend.example.com');
      });
    });

    it('should fallback to API_BASE when BACKEND_URL not set', () => {
      delete process.env.NEXT_PUBLIC_BACKEND_URL;
      process.env.NEXT_PUBLIC_API_BASE = 'https://base.example.com';
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';

      jest.isolateModules(() => {
        const { resolveApiBase } = require('@/lib/api');
        expect(resolveApiBase()).toBe('https://base.example.com');
      });
    });

    it('should fallback to API_URL when only API_URL is set (Railway fix)', () => {
      delete process.env.NEXT_PUBLIC_BACKEND_URL;
      delete process.env.NEXT_PUBLIC_API_BASE;
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';

      jest.isolateModules(() => {
        const { resolveApiBase } = require('@/lib/api');
        expect(resolveApiBase()).toBe('https://api.example.com');
      });
    });

    it('should fallback to production default when no env vars are set', () => {
      delete process.env.NEXT_PUBLIC_BACKEND_URL;
      delete process.env.NEXT_PUBLIC_API_BASE;
      delete process.env.NEXT_PUBLIC_API_URL;

      jest.isolateModules(() => {
        const { resolveApiBase } = require('@/lib/api');
        expect(resolveApiBase()).toBe(railwayDefault);
      });
    });

    it('should strip trailing slashes', () => {
      delete process.env.NEXT_PUBLIC_BACKEND_URL;
      process.env.NEXT_PUBLIC_API_BASE = 'https://base.example.com///';
      delete process.env.NEXT_PUBLIC_API_URL;

      jest.isolateModules(() => {
        const { resolveApiBase } = require('@/lib/api');
        expect(resolveApiBase()).toBe('https://base.example.com');
      });
    });
  });
});
