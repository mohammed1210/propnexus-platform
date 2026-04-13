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
});
