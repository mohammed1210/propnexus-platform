/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';

import AreaInsights from '@/components/property_details/AreaInsights';

const mockGetAreaIntel = jest.fn();
const mockGetComps = jest.fn();

jest.mock('@/lib/api', () => ({
  getAreaIntel: (...args: unknown[]) => mockGetAreaIntel(...args),
  getComps: (...args: unknown[]) => mockGetComps(...args),
}));

jest.mock('@/lib/auth', () => ({
  isAuthEnabled: false,
}));

describe('AreaInsights', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetComps.mockResolvedValue({ postcode: 'IG3 8AA', sales: [], rents: [] });
  });

  it('hides the panel when no live or derived evidence is available', async () => {
    mockGetAreaIntel.mockResolvedValue({
      key: 'IG3',
      source: 'unavailable',
      avg_price: null,
      avg_rent: null,
      rental_yield_percent: null,
      crime_source: 'unavailable',
      crime: null,
      schools_rating: null,
      transport_links: [],
      source_details: {},
    });

    const { container } = render(
      <AreaInsights areaKey="IG3" postcode="IG3 8AA" defaultExpanded />,
    );

    await waitFor(() => expect(mockGetAreaIntel).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('labels internal rental evidence as an average rent comp', async () => {
    mockGetAreaIntel.mockResolvedValue({
      key: 'IG3',
      source: 'partial_live',
      avg_price: 300000,
      avg_rent: 1500,
      rent_source: 'internal_property_listings',
      rental_yield_percent: 6,
      crime_source: 'unavailable',
      crime: null,
      source_details: { sales: 'land_registry_ppd', rent: 'internal_property_listings' },
      notes: 'Based on live evidence.',
    });

    render(<AreaInsights areaKey="IG3" postcode="IG3 8AA" defaultExpanded />);

    expect(await screen.findByText('Avg rent comp')).toBeInTheDocument();
    expect(screen.getByText('Average from internal rental listing evidence')).toBeInTheDocument();
    expect(screen.getByText('Internal rental listings')).toBeInTheDocument();
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
  });

  it('labels derived rent separately from rental comps', async () => {
    mockGetAreaIntel.mockResolvedValue({
      key: 'IG3',
      source: 'partial_live',
      avg_rent: 1450,
      rent_source: 'derived_internal_estimate',
      crime_source: 'unavailable',
      crime: null,
      source_details: { rent: 'derived_internal_estimate' },
      notes: 'Derived internal rent estimate.',
    });

    render(<AreaInsights areaKey="IG3" postcode="IG3 8AA" defaultExpanded />);

    expect(await screen.findByText('Rent estimate')).toBeInTheDocument();
    expect(screen.getByText('Derived internal estimate; not a rental comp')).toBeInTheDocument();
    expect(screen.queryByText('Avg rent comp')).not.toBeInTheDocument();
  });

  it('shows police.uk crime only when a real crime payload is present', async () => {
    mockGetAreaIntel.mockResolvedValue({
      key: 'IG3',
      source: 'partial_live',
      crime_source: 'police.uk',
      crime_count: 42,
      crime_period: '2026-03',
      crime_signal: 'moderate',
      crime_radius_label: 'approx. 1 mile',
      crime_note: 'Reported nearby street-level incidents from police.uk; not a safety rating.',
      source_details: { crime: 'police.uk' },
      notes: 'police.uk reported incident count.',
    });

    render(<AreaInsights areaKey="IG3" postcode="IG3 8AA" defaultExpanded />);

    expect(await screen.findByText('Reported nearby crime')).toBeInTheDocument();
    expect(screen.getByText('42 reports')).toBeInTheDocument();
    expect(screen.getByText(/police\.uk reported 42 nearby incidents for 2026-03/)).toBeInTheDocument();
    expect(screen.getByText('police.uk')).toBeInTheDocument();
  });
});
