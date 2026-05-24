import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import DealScore from '../property_details/DealScore';

const mockGetAreaIntel = jest.fn();
const mockGetComps = jest.fn();

jest.mock('@/lib/api', () => ({
  getAreaIntel: (...args: unknown[]) => mockGetAreaIntel(...args),
  getComps: (...args: unknown[]) => mockGetComps(...args),
}));

jest.mock('@/lib/normalizeProperty', () => ({
  normalizeProperty: (value: unknown) => value,
  formatRoiDisplay: (roiDisplay: { value: number | null | undefined; isProxy: boolean }) => {
    if (roiDisplay.isProxy && typeof roiDisplay.value === 'number' && roiDisplay.value > 40) return 'Needs validation';
    return typeof roiDisplay.value === 'number' ? `${roiDisplay.value.toFixed(1)}%` : 'N/A';
  },
  getRoiProxyValidationNote: (roiDisplay: { value: number | null | undefined; isProxy: boolean }) =>
    roiDisplay.isProxy && typeof roiDisplay.value === 'number' && roiDisplay.value > 40
      ? 'ROI proxy above normal range. Check rent, costs and finance assumptions.'
      : null,
  parseMoney: (value: unknown) => (typeof value === 'number' ? value : null),
  parseRent: (value: unknown) => (typeof value === 'number' ? value : null),
}));

beforeAll(() => {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(global, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
});

describe('DealScore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAreaIntel.mockResolvedValue({ source: 'unavailable', crime_source: 'unavailable' });
    mockGetComps.mockResolvedValue({ sales: [], rents: [] });
  });

  it('renders when only ai_score is present', () => {
    render(
      <DealScore
        property={{
          ai_score: 78,
          yieldPercent: 6,
          score_breakdown: {
            version: 'v1.1',
            categories: {
              yield: 14,
              roi: 16,
              price_to_rent: 11,
              area_demand: 12,
            },
          },
        }}
      />,
    );

    expect(screen.getByText('AI Deal Score')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.getByText(/Version v1\.1 .* Scores are indicative/i)).toBeInTheDocument();
  });

  it('prefers score when both score fields are present', () => {
    render(
      <DealScore
        property={{
          ai_score: 61,
          score: 84,
          yieldPercent: 6,
          score_breakdown: { version: 'v1.1' },
        }}
      />,
    );

    expect(screen.getByText('84')).toBeInTheDocument();
    expect(screen.queryByText('61')).not.toBeInTheDocument();
    expect(screen.getByText(/Version v1\.1 .* Scores are indicative/i)).toBeInTheDocument();
  });
});
