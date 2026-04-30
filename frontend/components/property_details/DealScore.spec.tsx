import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DealScore from './DealScore';

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

describe('DealScore breakdown display', () => {
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

  it('keeps the top-line score and detailed breakdown visible by default', () => {
    render(<DealScore property={property} />);

    expect(screen.getByText('AI Deal Score')).toBeInTheDocument();
    expect(screen.getByText('Rental Yield')).toBeInTheDocument();
    expect(screen.getByText(/Scores are indicative/i)).toBeInTheDocument();
  });
});
