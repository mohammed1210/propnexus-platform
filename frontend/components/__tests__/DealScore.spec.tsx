import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import DealScore from '../property_details/DealScore';

jest.mock('@/lib/flags', () => ({
  FF: {
    AI_SCORE_BREAKDOWN: false,
  },
}));

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
          score_breakdown: { version: 'v1.1' },
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
