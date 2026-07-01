import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import QuickStatsActions from './QuickStatsActions';

const mockFetchWithRetry = jest.fn();
const mockUseUserPlan = jest.fn();
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

jest.mock('@/lib/useUserPlan', () => ({
  useUserPlan: () => mockUseUserPlan(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('QuickStatsActions launch controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUserPlan.mockReturnValue({ plan: 'free', loading: false, error: null, refetch: jest.fn() });
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
    expect(screen.getAllByText('AI score').length).toBeGreaterThan(0);
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
    mockUseUserPlan.mockReturnValue({ plan: 'investor', loading: false, error: null, refetch: jest.fn() });

    render(
      <QuickStatsActions
        propertyId="prop-456"
        property={{ title: 'Riverside House', location: 'Manchester' }}
      />,
    );

    expect(screen.getAllByRole('button', { name: /export property details as pdf/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /copy property data as json/i })).toBeInTheDocument();
  });

  it('keeps PDF export locked for Investor Starter even when the feature flag is enabled', () => {
    mockFlagState.DEAL_PACK = true;
    mockUseUserPlan.mockReturnValue({ plan: 'pro', loading: false, error: null, refetch: jest.fn() });

    render(
      <QuickStatsActions
        propertyId="prop-457"
        property={{ title: 'Starter plan flat', location: 'Manchester' }}
      />,
    );

    expect(screen.queryByRole('button', { name: /export property details as pdf/i })).not.toBeInTheDocument();
  });

  it('does not mark saved when the API returns only unrelated saved deals', async () => {
    mockFetchWithRetry.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deals: [{ property_id: 'other-prop' }] }),
    });

    render(
      <QuickStatsActions
        propertyId="prop-789"
        property={{ title: 'Exact state check', location: 'Leeds' }}
      />,
    );

    await waitFor(() => expect(mockFetchWithRetry).toHaveBeenCalledWith('/api/saved-deals?property_id=prop-789', { cache: 'no-store' }));
    expect(screen.getAllByRole('button', { name: /save this deal/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /remove saved deal/i })).not.toBeInTheDocument();
  });

  it('marks saved when the exact property is returned', async () => {
    mockFetchWithRetry.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ saved: true, deals: [{ property_id: 'prop-abc' }] }),
    });

    render(
      <QuickStatsActions
        propertyId="prop-abc"
        property={{ title: 'Saved property', location: 'Leeds' }}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole('button', { name: /remove saved deal/i }).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Saved ✓/i).length).toBeGreaterThan(0);
  });

  it('saves then enables remove state for an unsaved property', async () => {
    mockFetchWithRetry
      .mockResolvedValueOnce({ ok: true, json: async () => ({ saved: false, deals: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    render(
      <QuickStatsActions
        propertyId="prop-save"
        property={{ title: 'Save property', location: 'Leeds' }}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole('button', { name: /save this deal/i }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: /save this deal/i })[0]);

    await waitFor(() => expect(mockFetchWithRetry).toHaveBeenCalledWith('/api/save-deal', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /remove saved deal/i }).length).toBeGreaterThan(0));
  });

  it('removes a saved property instead of disabling the button', async () => {
    mockFetchWithRetry
      .mockResolvedValueOnce({ ok: true, json: async () => ({ saved: true, deals: [{ property_id: 'prop-remove' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    render(
      <QuickStatsActions
        propertyId="prop-remove"
        property={{ title: 'Remove property', location: 'Leeds' }}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole('button', { name: /remove saved deal/i }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: /remove saved deal/i })[0]);

    await waitFor(() => expect(mockFetchWithRetry).toHaveBeenCalledWith('/api/saved-deals?property_id=prop-remove', expect.objectContaining({ method: 'DELETE' })));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /save this deal/i }).length).toBeGreaterThan(0));
  });
});
