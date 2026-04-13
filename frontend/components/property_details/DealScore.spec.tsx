import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DealScore from './DealScore';

const mockFlagState = {
  AI_SCORE_BREAKDOWN: false,
};

jest.mock('@/lib/flags', () => ({
  get FF() {
    return mockFlagState;
  },
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

describe('DealScore breakdown flag', () => {
  const property = {
    score: 82,
    score_breakdown: {
      version: 'v2.1',
      categories: {
        yield: 14,
        roi: 12,
      },
    },
    price: 250000,
    monthly_rent: 1500,
  };

  beforeEach(() => {
    mockFlagState.AI_SCORE_BREAKDOWN = false;
  });

  it('keeps the top-line score visible while hiding detailed breakdowns by default', () => {
    render(<DealScore property={property} />);

    expect(screen.getByText('AI Deal Score')).toBeInTheDocument();
    expect(screen.queryByText('Rental Yield')).not.toBeInTheDocument();
    expect(screen.queryByText(/Scores are indicative/i)).not.toBeInTheDocument();
  });

  it('shows detailed breakdowns when the flag is enabled', () => {
    mockFlagState.AI_SCORE_BREAKDOWN = true;

    render(<DealScore property={property} />);

    expect(screen.getByText('Rental Yield')).toBeInTheDocument();
    expect(screen.getByText(/Scores are indicative/i)).toBeInTheDocument();
  });
});
