import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import QuickStatsActions from './QuickStatsActions';

const mockExportPropertyPdf = jest.fn();
const mockFetchWithRetry = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockRouteFetch = jest.fn();
const clickSpy = jest.fn();
const oldFetch = global.fetch;
const oldCreateObjectURL = URL.createObjectURL;
const oldRevokeObjectURL = URL.revokeObjectURL;

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
    global.fetch = mockRouteFetch as any;
    URL.createObjectURL = jest.fn(() => 'blob:route-pdf');
    URL.revokeObjectURL = jest.fn();
    HTMLAnchorElement.prototype.click = clickSpy;
    mockFetchWithRetry.mockResolvedValue({
      ok: false,
      json: async () => ({ data: [] }),
    });
    mockExportPropertyPdf.mockResolvedValue(undefined);
    mockRouteFetch.mockResolvedValue({
      ok: true,
      blob: async () => new Blob([Uint8Array.from([37, 80, 68, 70])], { type: 'application/pdf' }),
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-disposition' ? 'attachment; filename="propnexus-route.pdf"' : null),
      },
    });
  });

  afterEach(() => {
    global.fetch = oldFetch;
    URL.createObjectURL = oldCreateObjectURL;
    URL.revokeObjectURL = oldRevokeObjectURL;
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

  it('uses the template PDF route as the primary export path', async () => {
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
      expect(mockToastSuccess).toHaveBeenCalledWith('PDF exported successfully.');
    });

    expect(mockRouteFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/property-pdf/prop-456'),
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      }),
    );
    expect(mockExportPropertyPdf).not.toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('does not crash export flow with sparse property data', async () => {
    render(<QuickStatsActions propertyId="prop-sparse" property={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Export property details as PDF' }));

    await waitFor(() => {
      expect(mockToastError).not.toHaveBeenCalled();
    });

    expect(mockRouteFetch).toHaveBeenCalledTimes(1);
    expect(mockExportPropertyPdf).not.toHaveBeenCalled();
  });

  it('falls back to the pdf-lib exporter when the primary route fails', async () => {
    mockRouteFetch.mockRejectedValueOnce(new Error('route failed'));

    render(
      <QuickStatsActions
        propertyId="prop-metrics"
        property={{ title: 'Metric Deal', location: 'York', yield_percent: 7.3, roi_percent: 12.8 }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export property details as PDF' }));

    await waitFor(() => {
      expect(mockExportPropertyPdf).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith('PDF exported successfully.');
    });

    expect(mockExportPropertyPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: 'prop-metrics',
        yieldPercent: 7.3,
        roiPercent: 12.8,
      }),
    );
  });
});
