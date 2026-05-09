import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';

const mockGetAreaIntel = jest.fn();
const mockGetComps = jest.fn();

jest.mock('@/lib/api', () => ({
  getAreaIntel: (...args: unknown[]) => mockGetAreaIntel(...args),
  getComps: (...args: unknown[]) => mockGetComps(...args),
}));

jest.mock('@/components/property_details/CollapsibleCard', () =>
  function MockCollapsibleCard({ children, title }: { children: React.ReactNode; title: string }) {
    return (
      <section>
        <h2>{title}</h2>
        {children}
      </section>
    );
  }
);

jest.mock('@/components/property_details/GatedPanel', () =>
  function MockGatedPanel({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }
);

describe('AreaInsights launch trimming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NEXT_PUBLIC_FEATURE_AREA_INTEL;
    delete process.env.NEXT_PUBLIC_FEATURE_COMPS;
  });

  it('hides the panel when there is no postcode', () => {
    const AreaInsights = require('./AreaInsights').default;
    const { container } = render(<AreaInsights areaKey="" postcode="" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('hides empty intel and comps states after loading', async () => {
    mockGetAreaIntel.mockResolvedValue(null);
    mockGetComps.mockResolvedValue({ sales: [], rents: [] });

    const AreaInsights = require('./AreaInsights').default;
    const { container } = render(<AreaInsights areaKey="Leeds" postcode="LS1 1AA" />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
    expect(screen.queryByText('No area intel available for this postcode yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('No comps available for this postcode yet.')).not.toBeInTheDocument();
  });

  it('uses a postcode embedded in the area key when postcode is missing', async () => {
    mockGetAreaIntel.mockResolvedValue({
      key: 'B15',
      postcode: 'B15 2QJ',
      source: 'partial_live',
      crime: { count: 0, month: '2026-04', source: 'police.uk' },
      source_details: { crime: 'police.uk' },
    });
    mockGetComps.mockResolvedValue({ sales: [], rents: [] });

    const AreaInsights = require('./AreaInsights').default;
    render(<AreaInsights areaKey="Farquhar Road, Birmingham, Edgbaston B15 2QJ" postcode="" />);

    expect(await screen.findByText('Reported crime signal')).toBeInTheDocument();
    expect(mockGetAreaIntel).toHaveBeenCalledWith('Farquhar Road, Birmingham, Edgbaston B15 2QJ');
    expect(mockGetComps).toHaveBeenCalledWith('B15 2QJ');
  });

  it('renders only available live or derived facts with source labels', async () => {
    mockGetAreaIntel.mockResolvedValue({
      key: 'IG3',
      avg_price: 305000,
      avg_rent: 1350,
      rental_yield_percent: 5.31,
      crime: { count: 42, month: '2026-03', source: 'police.uk' },
      crime_index: 42,
      source: 'partial_live',
      source_details: {
        sales: 'land_registry_ppd',
        rent: 'internal_property_listings',
        crime: 'police.uk',
        schools: 'not_available',
        population: 'not_available',
      },
      notes: 'Based on real available sources.',
      fetched_at: '2026-04-30T00:00:00Z',
    });
    mockGetComps.mockResolvedValue({
      postcode: 'IG3',
      source: 'partial_live',
      sales: [
        {
          address: '12 High Road, Ilford',
          price: 305000,
          date: '2026-01-12',
          type: 'T',
          source: 'land_registry_ppd',
        },
      ],
      rents: [],
    });

    const AreaInsights = require('./AreaInsights').default;
    render(<AreaInsights areaKey="IG3" postcode="IG3 8AA" />);

    expect(await screen.findByText('Sold-price benchmark')).toBeInTheDocument();
    expect(screen.getByText('Land Registry PPD')).toBeInTheDocument();
    expect(screen.getByText('Internal rental listings')).toBeInTheDocument();
    expect(screen.getAllByText('police.uk').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Mock intel|Replace with live sources|10 IG3 Street|Schools rating|Population/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Safety Index/i)).not.toBeInTheDocument();
  });
});
