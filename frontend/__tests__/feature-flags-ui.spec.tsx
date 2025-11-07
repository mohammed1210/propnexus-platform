/**
 * Sprint 11.2: Test feature flag enforcement in UI components
 * Verify that AI panels (DealScore, AreaIntel, Comps) respect feature flags
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the flags module
jest.mock('@/lib/flags', () => ({
  FF: {
    AI_CHAT: false,
    DEAL_SCORE: false,
    AREA_INTEL: false,
    COMPS: false,
  },
}));

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
      // Re-mock with DEAL_SCORE = false
      jest.doMock('@/lib/flags', () => ({
        FF: {
          AI_CHAT: false,
          DEAL_SCORE: false,
          AREA_INTEL: false,
          COMPS: false,
        },
      }));

      const PropertyPage = require('@/app/property/[id]/page').default;
      const { container } = render(<PropertyPage />);

      // Wait for component to render
      await screen.findByText(/Property Details/i, {}, { timeout: 3000 });

      // Verify AI Deal Score is NOT present
      expect(container.textContent).not.toMatch(/AI Deal Score/i);
    });

    it('should render when DEAL_SCORE flag is true', async () => {
      // Re-mock with DEAL_SCORE = true
      jest.doMock('@/lib/flags', () => ({
        FF: {
          AI_CHAT: false,
          DEAL_SCORE: true,
          AREA_INTEL: false,
          COMPS: false,
        },
      }));

      // Clear module cache to pick up new mock
      jest.resetModules();
      
      const PropertyPage = require('@/app/property/[id]/page').default;
      const { container } = render(<PropertyPage />);

      // Wait for component to render
      await screen.findByText(/Property Details/i, {}, { timeout: 3000 });

      // Verify AI Deal Score IS present
      expect(container.textContent).toMatch(/AI Deal Score/i);
    });
  });

  describe('Area Intelligence Panel', () => {
    it('should not render when AREA_INTEL flag is false', async () => {
      jest.doMock('@/lib/flags', () => ({
        FF: {
          AI_CHAT: false,
          DEAL_SCORE: false,
          AREA_INTEL: false,
          COMPS: false,
        },
      }));

      const PropertyPage = require('@/app/property/[id]/page').default;
      const { container } = render(<PropertyPage />);

      await screen.findByText(/Property Details/i, {}, { timeout: 3000 });

      // Verify Area Intelligence is NOT present
      expect(container.textContent).not.toMatch(/Area Intelligence/i);
    });

    it('should render when AREA_INTEL flag is true', async () => {
      jest.doMock('@/lib/flags', () => ({
        FF: {
          AI_CHAT: false,
          DEAL_SCORE: false,
          AREA_INTEL: true,
          COMPS: false,
        },
      }));

      jest.resetModules();
      
      const PropertyPage = require('@/app/property/[id]/page').default;
      const { container } = render(<PropertyPage />);

      await screen.findByText(/Property Details/i, {}, { timeout: 3000 });

      // Verify Area Intelligence IS present
      expect(container.textContent).toMatch(/Area Intelligence/i);
    });
  });

  describe('Comparable Sales Panel', () => {
    it('should not render when COMPS flag is false', async () => {
      jest.doMock('@/lib/flags', () => ({
        FF: {
          AI_CHAT: false,
          DEAL_SCORE: false,
          AREA_INTEL: false,
          COMPS: false,
        },
      }));

      const PropertyPage = require('@/app/property/[id]/page').default;
      const { container } = render(<PropertyPage />);

      await screen.findByText(/Property Details/i, {}, { timeout: 3000 });

      // Verify Comparable Sales is NOT present
      expect(container.textContent).not.toMatch(/Comparable Sales/i);
    });

    it('should render when COMPS flag is true', async () => {
      jest.doMock('@/lib/flags', () => ({
        FF: {
          AI_CHAT: false,
          DEAL_SCORE: false,
          AREA_INTEL: false,
          COMPS: true,
        },
      }));

      jest.resetModules();
      
      const PropertyPage = require('@/app/property/[id]/page').default;
      const { container } = render(<PropertyPage />);

      await screen.findByText(/Property Details/i, {}, { timeout: 3000 });

      // Verify Comparable Sales IS present
      expect(container.textContent).toMatch(/Comparable Sales/i);
    });
  });

  describe('AI Chatbot', () => {
    it('should not render when AI_CHAT flag is false', async () => {
      jest.doMock('@/lib/flags', () => ({
        FF: {
          AI_CHAT: false,
          DEAL_SCORE: false,
          AREA_INTEL: false,
          COMPS: false,
        },
      }));

      const PropertyPage = require('@/app/property/[id]/page').default;
      const { container } = render(<PropertyPage />);

      await screen.findByText(/Property Details/i, {}, { timeout: 3000 });

      // Chatbot should not be rendered
      // Note: Chatbot component structure may vary
      expect(container.querySelector('[data-testid="ai-chatbot"]')).toBeNull();
    });
  });
});
