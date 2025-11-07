/**
 * Sprint 11.2: Test feature flag enforcement in UI components
 * Verify that AI panels (DealScore, AreaIntel, Comps) respect feature flags
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Helper function to mock feature flags with overrides
function mockFeatureFlags(overrides = {}) {
  return {
    FF: {
      AI_CHAT: false,
      DEAL_SCORE: false,
      AREA_INTEL: false,
      COMPS: false,
      ...overrides,
    },
  };
}

// Mock the flags module
jest.mock('@/lib/flags', () => mockFeatureFlags());

// Mock Supabase client to avoid errors
jest.mock('@/lib/supabaseClient', () => ({
  getSupabase: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ 
            data: {
              id: '123',
              title: 'Test Property',
              price: 250000,
              location: 'SW1A 1AA',
              latitude: 51.5,
              longitude: -0.1,
            },
            error: null 
          }))
        }))
      }))
    })),
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null }))
    }
  }))
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: '123' }),
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/property/123',
}));

describe('Feature Flag UI Gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AI Deal Score Panel', () => {
    it('should not render when DEAL_SCORE flag is false', async () => {
      jest.doMock('@/lib/flags', () => mockFeatureFlags());

      const PropertyPage = require('@/app/property/[id]/page').default;
      const { container } = render(<PropertyPage />);

      await screen.findByText(/Property Details/i, {}, { timeout: 3000 });

      expect(container.textContent).not.toMatch(/AI Deal Score/i);
    });

    it('should render when DEAL_SCORE flag is true', async () => {
      jest.doMock('@/lib/flags', () => mockFeatureFlags({ DEAL_SCORE: true }));

      jest.resetModules();
      
      const PropertyPage = require('@/app/property/[id]/page').default;
      const { container } = render(<PropertyPage />);

      await screen.findByText(/Property Details/i, {}, { timeout: 3000 });

      expect(container.textContent).toMatch(/AI Deal Score/i);
    });
  });

  describe('Area Intelligence Panel', () => {
    it('should not render when AREA_INTEL flag is false', async () => {
      jest.doMock('@/lib/flags', () => mockFeatureFlags());

      const PropertyPage = require('@/app/property/[id]/page').default;
      const { container } = render(<PropertyPage />);

      await screen.findByText(/Property Details/i, {}, { timeout: 3000 });

      expect(container.textContent).not.toMatch(/Area Intelligence/i);
    });

    it('should render when AREA_INTEL flag is true', async () => {
      jest.doMock('@/lib/flags', () => mockFeatureFlags({ AREA_INTEL: true }));

      jest.resetModules();
      
      const PropertyPage = require('@/app/property/[id]/page').default;
      const { container } = render(<PropertyPage />);

      await screen.findByText(/Property Details/i, {}, { timeout: 3000 });

      expect(container.textContent).toMatch(/Area Intelligence/i);
    });
  });

  describe('Comparable Sales Panel', () => {
    it('should not render when COMPS flag is false', async () => {
      jest.doMock('@/lib/flags', () => mockFeatureFlags());

      const PropertyPage = require('@/app/property/[id]/page').default;
      const { container } = render(<PropertyPage />);

      await screen.findByText(/Property Details/i, {}, { timeout: 3000 });

      expect(container.textContent).not.toMatch(/Comparable Sales/i);
    });

    it('should render when COMPS flag is true', async () => {
      jest.doMock('@/lib/flags', () => mockFeatureFlags({ COMPS: true }));

      jest.resetModules();
      
      const PropertyPage = require('@/app/property/[id]/page').default;
      const { container } = render(<PropertyPage />);

      await screen.findByText(/Property Details/i, {}, { timeout: 3000 });

      expect(container.textContent).toMatch(/Comparable Sales/i);
    });
  });

  describe('AI Chatbot', () => {
    it('should not render when AI_CHAT flag is false', async () => {
      jest.doMock('@/lib/flags', () => mockFeatureFlags());

      const PropertyPage = require('@/app/property/[id]/page').default;
      const { container } = render(<PropertyPage />);

      await screen.findByText(/Property Details/i, {}, { timeout: 3000 });

      // Chatbot should not be rendered
      expect(container.querySelector('[data-testid="ai-chatbot"]')).toBeNull();
    });
  });
});
