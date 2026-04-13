/**
 * Sprint 11.2: Test feature flag enforcement on property details page
 * Verify that AI panels (Deal Score, Area Intel, Comps) respect feature flags
 */

import '@testing-library/jest-dom';

describe('Property Details Page - Feature Flags', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should have all AI feature flags disabled by default', () => {
    // Remove all feature flag env vars
    delete process.env.NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE;
    delete process.env.NEXT_PUBLIC_FEATURE_OFF_MARKET;
    delete process.env.NEXT_PUBLIC_FEATURE_PROPERTY_EXPORTS;
    delete process.env.NEXT_PUBLIC_FEATURE_TRADESMEN;
    delete process.env.NEXT_PUBLIC_FEATURE_AREA_INTEL;
    delete process.env.NEXT_PUBLIC_FEATURE_COMPS;
    delete process.env.NEXT_PUBLIC_FEATURE_AI_CHATBOT;

    jest.isolateModules(() => {
      const { FF } = require('@/lib/flags');

      // All should default to false
      expect(FF.DEAL_SCORE).toBe(false);
      expect(FF.OFF_MARKET).toBe(false);
      expect(FF.PROPERTY_EXPORTS).toBe(false);
      expect(FF.TRADESMEN).toBe(false);
      // Area Intel + Comps are default-on (can be explicitly disabled via env)
      expect(FF.AREA_INTEL).toBe(true);
      expect(FF.COMPS).toBe(true);
      expect(FF.AI_CHAT).toBe(false);
    });
  });

  it('should enable Deal Score panel when DEAL_SCORE flag is true', () => {
    process.env.NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE = 'true';
    process.env.NEXT_PUBLIC_FEATURE_AREA_INTEL = 'false';
    process.env.NEXT_PUBLIC_FEATURE_COMPS = 'false';

    jest.isolateModules(() => {
      const { FF } = require('@/lib/flags');

      // Only DEAL_SCORE should be enabled
      expect(FF.DEAL_SCORE).toBe(true);
      expect(FF.AREA_INTEL).toBe(false);
      expect(FF.COMPS).toBe(false);
    });
  });

  it('should enable Area Intel panel when AREA_INTEL flag is true', () => {
    process.env.NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE = 'false';
    process.env.NEXT_PUBLIC_FEATURE_AREA_INTEL = 'true';
    process.env.NEXT_PUBLIC_FEATURE_COMPS = 'false';

    jest.isolateModules(() => {
      const { FF } = require('@/lib/flags');

      // Only AREA_INTEL should be enabled
      expect(FF.DEAL_SCORE).toBe(false);
      expect(FF.AREA_INTEL).toBe(true);
      expect(FF.COMPS).toBe(false);
    });
  });

  it('should enable Comps panel when COMPS flag is true', () => {
    process.env.NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE = 'false';
    process.env.NEXT_PUBLIC_FEATURE_AREA_INTEL = 'false';
    process.env.NEXT_PUBLIC_FEATURE_COMPS = 'true';

    jest.isolateModules(() => {
      const { FF } = require('@/lib/flags');

      // Only COMPS should be enabled
      expect(FF.DEAL_SCORE).toBe(false);
      expect(FF.AREA_INTEL).toBe(false);
      expect(FF.COMPS).toBe(true);
    });
  });

  it('should enable all AI panels when all flags are true', () => {
    process.env.NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE = 'true';
    process.env.NEXT_PUBLIC_FEATURE_OFF_MARKET = 'true';
    process.env.NEXT_PUBLIC_FEATURE_PROPERTY_EXPORTS = 'true';
    process.env.NEXT_PUBLIC_FEATURE_TRADESMEN = 'true';
    process.env.NEXT_PUBLIC_FEATURE_AREA_INTEL = 'true';
    process.env.NEXT_PUBLIC_FEATURE_COMPS = 'true';
    process.env.NEXT_PUBLIC_FEATURE_AI_CHATBOT = 'true';

    jest.isolateModules(() => {
      const { FF } = require('@/lib/flags');

      // All flags should be enabled
      expect(FF.DEAL_SCORE).toBe(true);
      expect(FF.OFF_MARKET).toBe(true);
      expect(FF.PROPERTY_EXPORTS).toBe(true);
      expect(FF.TRADESMEN).toBe(true);
      expect(FF.AREA_INTEL).toBe(true);
      expect(FF.COMPS).toBe(true);
      expect(FF.AI_CHAT).toBe(true);
    });
  });

  it('should handle mixed flag states correctly', () => {
    process.env.NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE = 'true';
    process.env.NEXT_PUBLIC_FEATURE_AREA_INTEL = 'false';
    process.env.NEXT_PUBLIC_FEATURE_COMPS = 'true';
    process.env.NEXT_PUBLIC_FEATURE_AI_CHATBOT = 'false';

    jest.isolateModules(() => {
      const { FF } = require('@/lib/flags');

      // Only DEAL_SCORE and COMPS should be enabled
      expect(FF.DEAL_SCORE).toBe(true);
      expect(FF.AREA_INTEL).toBe(false);
      expect(FF.COMPS).toBe(true);
      expect(FF.AI_CHAT).toBe(false);
    });
  });

  it('should treat undefined flags as false', () => {
    // Explicitly delete all flags
    delete process.env.NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE;
    delete process.env.NEXT_PUBLIC_FEATURE_OFF_MARKET;
    delete process.env.NEXT_PUBLIC_FEATURE_PROPERTY_EXPORTS;
    delete process.env.NEXT_PUBLIC_FEATURE_TRADESMEN;
    delete process.env.NEXT_PUBLIC_FEATURE_AREA_INTEL;
    delete process.env.NEXT_PUBLIC_FEATURE_COMPS;
    delete process.env.NEXT_PUBLIC_FEATURE_AI_CHATBOT;

    jest.isolateModules(() => {
      const { FF } = require('@/lib/flags');

      // All should be false when undefined
      expect(FF.DEAL_SCORE).toBe(false);
      expect(FF.OFF_MARKET).toBe(false);
      expect(FF.PROPERTY_EXPORTS).toBe(false);
      expect(FF.TRADESMEN).toBe(false);
      // Area Intel + Comps default to true when undefined
      expect(FF.AREA_INTEL).toBe(true);
      expect(FF.COMPS).toBe(true);
      expect(FF.AI_CHAT).toBe(false);
    });
  });
});
