import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import QuickStatsActions from './QuickStatsActions';

const mockFetchWithRetry = jest.fn();

jest.mock('@/lib/api', () => ({
  fetchWithRetry: (...args: unknown[]) => mockFetchWithRetry(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('QuickStatsActions launch actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithRetry.mockResolvedValue({
      ok: false,
      json: async () => ({ data: [] }),
    });
  });

  it('keeps save/share visible while hiding soft-launch disabled exports', () => {
    render(
      <QuickStatsActions
        propertyId="prop-123"
        property={{ title: 'Central Flat', location: 'Leeds' }}
        price={210000}
        yieldPercent={6.4}
        roiPercent={8.1}
      />,
    );

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /save this deal/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /share this property/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy property data as json/i })).not.toBeInTheDocument();
  });
});
