import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import QuickStatsActions from './QuickStatsActions';

const mockExportPropertyPdf = jest.fn();
const mockFetchWithRetry = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('@/lib/propertyPdfExport', () => ({
  exportPropertyPdf: (...args: unknown[]) => mockExportPropertyPdf(...args),
}));

jest.mock('@/lib/api', () => ({
  fetchWithRetry: (...args: unknown[]) => mockFetchWithRetry(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('QuickStatsActions PDF export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithRetry.mockResolvedValue({
      ok: false,
      json: async () => ({ data: [] }),
    });
    mockExportPropertyPdf.mockResolvedValue(undefined);
  });

  it('renders export actions in quick actions UI', () => {
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
    expect(screen.getAllByRole('button', { name: /export/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('executes PDF export handler when export is clicked', async () => {
    render(
      <QuickStatsActions
        propertyId="prop-456"
        property={{ title: 'Riverside House', location: 'Manchester', bedrooms: 3, bathrooms: 2 }}
        price={325000}
        yieldPercent={5.8}
        roiPercent={7.2}
        discountPercent={12.3}
        aiScore={8.9}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export property details as PDF' }));

    await waitFor(() => {
      expect(mockExportPropertyPdf).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith('PDF exported successfully.');
    });

    expect(mockExportPropertyPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: 'prop-456',
        price: 325000,
        yieldPercent: 5.8,
        roiPercent: 7.2,
        discountPercent: 12.3,
        aiScore: 8.9,
      }),
    );
  });

  it('does not crash export flow with sparse property data', async () => {
    render(<QuickStatsActions propertyId="prop-sparse" property={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Export property details as PDF' }));

    await waitFor(() => {
      expect(mockExportPropertyPdf).toHaveBeenCalledTimes(1);
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });
});
