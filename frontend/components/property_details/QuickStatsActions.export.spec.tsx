import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import QuickStatsActions from './QuickStatsActions';

const mockFetchWithRetry = jest.fn();
const mockFlagState = {
  DEAL_PACK: false,
  CRM_EXPORT: false,
};

jest.mock('@/lib/api', () => ({
  fetchWithRetry: (...args: unknown[]) => mockFetchWithRetry(...args),
}));

jest.mock('@/lib/flags', () => ({
  get FF() {
    return mockFlagState;
  },
}));

describe('QuickStatsActions launch controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFlagState.DEAL_PACK = false;
    mockFlagState.CRM_EXPORT = false;
    mockFetchWithRetry.mockResolvedValue({
      ok: false,
      json: async () => ({ data: [] }),
    });
  });

  it('keeps save, share and deal action visible while moving stats into a collapsed Deal Snapshot', () => {
    const { container } = render(
      <QuickStatsActions
        propertyId="prop-123"
        property={{ title: 'Central Flat', location: 'Leeds', source_url: 'https://www.rightmove.co.uk/properties/123' }}
        price={210000}
        yieldPercent={6.4}
        roiPercent={8.1}
        discountPercent={undefined}
        aiScore={8.4}
      />,
    );

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Deal Action')).toBeInTheDocument();
    expect(screen.getByText('Deal Snapshot')).toBeInTheDocument();
    expect(screen.getByText('AI Score')).toBeInTheDocument();
    expect(screen.getByText('8.4')).toBeInTheDocument();
    expect(screen.queryByText('Quick Stats')).not.toBeInTheDocument();
    expect(screen.queryByText('Discount')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /save this deal/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /share this property/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /view on rightmove/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export property details as pdf/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy property data as json/i })).not.toBeInTheDocument();

    const snapshot = screen.getByText('Deal Snapshot').closest('details');
    expect(snapshot).toBeInTheDocument();
    expect(snapshot).not.toHaveAttribute('open');

    const text = container.textContent ?? '';
    expect(text.indexOf('Quick Actions')).toBeLessThan(text.indexOf('Deal Action'));
    expect(text.indexOf('Deal Action')).toBeLessThan(text.indexOf('Deal Snapshot'));
  });

  it('can re-enable deal pack and CRM export actions independently', () => {
    mockFlagState.DEAL_PACK = true;
    mockFlagState.CRM_EXPORT = true;

    render(
      <QuickStatsActions
        propertyId="prop-456"
        property={{ title: 'Riverside House', location: 'Manchester' }}
      />,
    );

    expect(screen.getAllByRole('button', { name: /export property details as pdf/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /copy property data as json/i })).toBeInTheDocument();
  });
});
