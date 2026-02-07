/**
 * Sprint 11: Test feature flag enforcement
 * Verify that AI components use FF from lib/flags.ts and respect the flags
 */

import { FF } from '@/lib/flags';

describe('Feature Flags', () => {
  // Store original env values
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules and env before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('should default to false when env vars are not set', () => {
    // Remove all feature flag env vars
    delete process.env.NEXT_PUBLIC_FEATURE_AI_CHATBOT;
    delete process.env.NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE;
    delete process.env.NEXT_PUBLIC_FEATURE_AREA_INTEL;
    delete process.env.NEXT_PUBLIC_FEATURE_COMPS;

    // Re-import to get fresh values
    jest.isolateModules(() => {
      const { FF } = require('@/lib/flags');

      expect(FF.AI_CHAT).toBe(false);
      expect(FF.DEAL_SCORE).toBe(false);
      // Area Intel + Comps are default-on (can be explicitly disabled)
      expect(FF.AREA_INTEL).toBe(true);
      expect(FF.COMPS).toBe(true);
    });
  });

  it('should respect "true" value', () => {
    process.env.NEXT_PUBLIC_FEATURE_AI_CHATBOT = 'true';
    process.env.NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE = 'true';

    jest.isolateModules(() => {
      const { FF } = require('@/lib/flags');

      expect(FF.AI_CHAT).toBe(true);
      expect(FF.DEAL_SCORE).toBe(true);
    });
  });

  it('should respect "1" value', () => {
    process.env.NEXT_PUBLIC_FEATURE_AREA_INTEL = '1';
    process.env.NEXT_PUBLIC_FEATURE_COMPS = '1';

    jest.isolateModules(() => {
      const { FF } = require('@/lib/flags');

      expect(FF.AREA_INTEL).toBe(true);
      expect(FF.COMPS).toBe(true);
    });
  });

  it('should respect "false" value', () => {
    process.env.NEXT_PUBLIC_FEATURE_AI_CHATBOT = 'false';
    process.env.NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE = 'false';
    process.env.NEXT_PUBLIC_FEATURE_AREA_INTEL = 'false';
    process.env.NEXT_PUBLIC_FEATURE_COMPS = 'false';

    jest.isolateModules(() => {
      const { FF } = require('@/lib/flags');

      expect(FF.AI_CHAT).toBe(false);
      expect(FF.DEAL_SCORE).toBe(false);
      expect(FF.AREA_INTEL).toBe(false);
      expect(FF.COMPS).toBe(false);
    });
  });

  it('should handle case-insensitive values', () => {
    process.env.NEXT_PUBLIC_FEATURE_AI_CHATBOT = 'TRUE';
    process.env.NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE = 'YES';
    process.env.NEXT_PUBLIC_FEATURE_AREA_INTEL = 'On';

    jest.isolateModules(() => {
      const { FF } = require('@/lib/flags');

      expect(FF.AI_CHAT).toBe(true);
      expect(FF.DEAL_SCORE).toBe(true);
      expect(FF.AREA_INTEL).toBe(true);
    });
  });
});
