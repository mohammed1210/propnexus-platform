import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DealScore from './DealScore';

const mockGetAreaIntel = jest.fn();
const mockGetComps = jest.fn();

jest.mock('@/lib/api', () => ({
  getAreaIntel: (...args: unknown[]) => mockGetAreaIntel(...args),
  getComps: (...args: unknown[]) => mockGetComps(...args),
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

describe('DealScore breakdown display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAreaIntel.mockResolvedValue({ source: 'unavailable', crime_source: 'unavailable' });
    mockGetComps.mockResolvedValue({ sales: [], rents: [] });
  });

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
    postcode: 'IG3 8AA',
    monthly_rent: 1500,
  };

  it('keeps the top-line score and detailed breakdown visible by default', () => {
    render(<DealScore property={property} />);

    expect(screen.getByText('AI Deal Score')).toBeInTheDocument();
    expect(screen.getAllByText('Rental Yield').length).toBeGreaterThan(0);
    expect(screen.getByText('Evidence-backed score drivers')).toBeInTheDocument();
    expect(screen.getByText('Investor verdict')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-score-logic-chart')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open ai score logic graph/i }));
    expect(screen.getByTestId('ai-score-logic-chart')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /ai score logic graph/i })).toBeInTheDocument();
    expect(screen.getByText('Score logic')).toBeInTheDocument();
    expect(screen.getByText(/How the visible factors support the score/i)).toBeInTheDocument();
    expect(screen.getByText('Best fit')).toBeInTheDocument();
    expect(screen.getByText('Strongest signal')).toBeInTheDocument();
    expect(screen.getByText('Main check before offer')).toBeInTheDocument();
    expect(screen.queryByText('Top scoring factors')).not.toBeInTheDocument();
    expect(screen.queryByText('Investor lens')).not.toBeInTheDocument();
    expect(screen.getByText(/Scores are indicative/i)).toBeInTheDocument();
  });

  it('shows Needs validation instead of an unrealistic ROI proxy percentage', () => {
    render(
      <DealScore
        property={{
          score: 70,
          price: 100000,
          rent_monthly: 5000,
          score_breakdown: { version: 'v2.1', categories: { yield: 12, roi: 10 } },
        }}
      />,
    );

    expect(screen.getByText('Needs validation')).toBeInTheDocument();
    expect(screen.getByText('ROI proxy above normal range. Check rent, costs and finance assumptions.')).toBeInTheDocument();
  });

  it('keeps normal ROI values displayed normally', () => {
    render(
      <DealScore
        property={{
          score: 70,
          roi_percent: 12,
          score_breakdown: { version: 'v2.1', categories: { yield: 12, roi: 10 } },
        }}
      />,
    );

    expect(screen.getAllByText('12.0%').length).toBeGreaterThan(0);
    expect(screen.queryByText('Needs validation')).not.toBeInTheDocument();
  });

  it('hides schools and safety labels when live evidence is missing', async () => {
    render(
      <DealScore
        property={{
          ...property,
          score_breakdown: {
            version: 'v2.1',
            categories: {
              yield: 14,
              roi: 12,
              price_to_rent: 11,
              area_demand: 12,
              crime_index_inverse: 7.5,
              schools_access: 9,
            },
          },
        }}
      />,
    );

    await waitFor(() => expect(mockGetAreaIntel).toHaveBeenCalled());
    expect(screen.queryByText(/Safety Index/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Schools Access/i)).not.toBeInTheDocument();
  });

  it('shows schools access only when backed by a real schools source', async () => {
    mockGetAreaIntel.mockResolvedValue({
      source: 'partial_live',
      crime_source: 'unavailable',
      schools_rating: 4.2,
      source_details: { schools: 'local_authority' },
    });

    render(<DealScore property={property} />);

    expect((await screen.findAllByText('Schools Access')).length).toBeGreaterThan(0);
    expect(screen.getByText('4.2/5')).toBeInTheDocument();
    expect(screen.getByText('Schools source')).toBeInTheDocument();
  });

  it('shows reported crime only when police.uk evidence exists', async () => {
    mockGetAreaIntel.mockResolvedValue({
      source: 'partial_live',
      crime_source: 'police.uk',
      crime_count: 18,
      crime_signal: 'low',
      crime_period: '2026-04',
      source_details: { crime: 'police.uk' },
    });

    render(<DealScore property={property} />);

    expect((await screen.findAllByText('Reported Crime Signal')).length).toBeGreaterThan(0);
    expect(screen.getByText('police.uk • 2026-04')).toBeInTheDocument();
    expect(screen.getAllByText(/Not a safety rating/i).length).toBeGreaterThan(0);
  });

  it('does not show reported crime without police.uk evidence', async () => {
    mockGetAreaIntel.mockResolvedValue({
      source: 'partial_live',
      crime_source: 'unavailable',
      crime_count: null,
      source_details: { crime: 'not_available' },
    });

    render(<DealScore property={property} />);

    await waitFor(() => expect(mockGetAreaIntel).toHaveBeenCalled());
    expect(screen.queryByText('Reported Crime Signal')).not.toBeInTheDocument();
  });

  it('shows price-to-rent when rent evidence exists', async () => {
    mockGetAreaIntel.mockResolvedValue({
      source: 'partial_live',
      avg_rent: 1450,
      rent_source: 'internal_property_listings',
      rent_evidence_count: 2,
      crime_source: 'unavailable',
      source_details: { rent: 'internal_property_listings' },
    });

    render(
      <DealScore
        property={{
          score: 70,
          postcode: 'IG3 8AA',
          price: 260000,
          yield_percent: 5,
          score_breakdown: { version: 'v2.1', categories: { yield: 12, roi: 10 } },
        }}
      />,
    );

    expect((await screen.findAllByText('Price-to-Rent')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rent evidence').length).toBeGreaterThan(0);
  });

  it('hides price-to-rent when rent evidence is missing', async () => {
    render(
      <DealScore
        property={{
          score: 70,
          postcode: 'IG3 8AA',
          price: 260000,
          yield_percent: 5,
          score_breakdown: { version: 'v2.1', categories: { yield: 12, roi: 10, price_to_rent: 15 } },
        }}
      />,
    );

    await waitFor(() => expect(mockGetAreaIntel).toHaveBeenCalled());
    expect(screen.queryByText('Price-to-Rent')).not.toBeInTheDocument();
  });

  it('shows area demand when sold comps exist', async () => {
    mockGetComps.mockResolvedValue({
      sales: [
        { price: 300000, date: '2026-03-01', source: 'land_registry_ppd' },
        { price: 315000, date: '2026-02-01', source: 'land_registry_ppd' },
      ],
      rents: [],
      source_details: { sales: 'land_registry_ppd' },
    });

    render(<DealScore property={property} />);

    expect((await screen.findAllByText('Area Demand')).length).toBeGreaterThan(0);
    expect(screen.getByText('Land Registry PPD')).toBeInTheDocument();
  });
});
