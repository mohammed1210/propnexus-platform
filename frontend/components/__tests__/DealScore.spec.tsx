import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import DealScore from '../property_details/DealScore';

jest.mock('@/lib/normalizeProperty', () => ({
  normalizeProperty: (value: unknown) => value,
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
  it('renders when only ai_score is present', () => {
    render(
      <DealScore
        property={{
          ai_score: 78,
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
  });

  it('prefers score when both score fields are present', () => {
    render(
      <DealScore
        property={{
          ai_score: 61,
          score: 84,
          score_breakdown: { version: 'v1.1' },
        }}
      />,
    );

    expect(screen.getByText('84')).toBeInTheDocument();
    expect(screen.queryByText('61')).not.toBeInTheDocument();
  });
});
