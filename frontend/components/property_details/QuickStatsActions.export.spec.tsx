import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import QuickStatsActions from './QuickStatsActions';

const mockFetchWithRetry = jest.fn();
const mockFlagState = {
  PROPERTY_EXPORTS: false,
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
    mockFlagState.PROPERTY_EXPORTS = false;
    mockFetchWithRetry.mockResolvedValue({
      ok: false,
      json: async () => ({ data: [] }),
    });
  });

  it('keeps save and share visible while hiding export actions by default', () => {
    render(
      <QuickStatsActions
        propertyId="prop-123"
        property={{ title: 'Central Flat', location: 'Leeds' }}
        price={210000}
        yieldPercent={6.4}
        roiPercent={8.1}
      />,
    );

    expect(screen.getAllByRole('button', { name: /save this deal/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /share this property/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /export property details as pdf/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy property data as json/i })).not.toBeInTheDocument();
  });

  it('can re-enable export actions with the feature flag', () => {
    mockFlagState.PROPERTY_EXPORTS = true;

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
