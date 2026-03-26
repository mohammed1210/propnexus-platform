import { render, screen, waitFor } from '@testing-library/react';

import InvestmentSummary from '../property_details/InvestmentSummary';
import { postAiSummary } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  postAiSummary: jest.fn(),
}));

const mockPostAiSummary = postAiSummary as jest.MockedFunction<typeof postAiSummary>;

const propertyFixture = {
  title: '2-bed terrace',
  location: 'Leeds',
  price: 180000,
  bedrooms: 2,
  bathrooms: 1,
  description: 'Solid rental demand in established area',
};

describe('InvestmentSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders summary content when summary request succeeds', async () => {
    mockPostAiSummary.mockResolvedValue({
      summary: 'Strong cashflow profile with scope to increase rent.',
      bullets: ['Good local demand', 'Below market pricing'],
    } as any);

    render(<InvestmentSummary property={propertyFixture as any} />);

    await waitFor(() => {
      expect(screen.getByTestId('investment-summary-text')).toBeInTheDocument();
    });

    expect(screen.getByText('Strong cashflow profile with scope to increase rent.')).toBeInTheDocument();
    expect(screen.getByText('Good local demand')).toBeInTheDocument();
  });

  it('renders a safe fallback when summary request fails with non-JSON/404 style error', async () => {
    mockPostAiSummary.mockRejectedValue(
      new Error('[POST 404] <!doctype html><html><body><h1>Not Found</h1></body></html>'),
    );

    render(<InvestmentSummary property={propertyFixture as any} />);

    await waitFor(() => {
      expect(screen.getByTestId('investment-summary-fallback')).toBeInTheDocument();
    });

    expect(screen.getByText('Summary unavailable')).toBeInTheDocument();
    expect(
      screen.getByText('We could not generate an investment summary right now. Please try again later.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/<!doctype html>/i)).not.toBeInTheDocument();
  });
});
