import '@testing-library/jest-dom';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ListingsPage from '@/app/listings/page';

let mockCurrentParams = new URLSearchParams('sort=price_asc&offset=0');
const mockPush = jest.fn((url: string) => {
  mockCurrentParams = new URLSearchParams(url.split('?')[1] ?? '');
});
const mockReplace = jest.fn((url: string) => {
  mockCurrentParams = new URLSearchParams(url.split('?')[1] ?? '');
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockCurrentParams,
}));

jest.mock('next/dynamic', () => () => function DynamicMock() {
  return null;
});

jest.mock('next/link', () => {
  return function LinkMock({ children, href }: any) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('@/components/PropertyCard', () => ({
  __esModule: true,
  default: ({ p }: any) => <article>{p.title}</article>,
}));

jest.mock('@/components/SaveSearchAlert', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/lib/auth', () => ({
  isAuthEnabled: false,
}));

const fetchMock = jest.fn();

describe('Listings page regressions', () => {
  beforeEach(() => {
    mockCurrentParams = new URLSearchParams('sort=price_asc&offset=0');
    mockPush.mockClear();
    mockReplace.mockClear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'rightmove-1',
            title: 'Visible Rightmove',
            source: 'rightmove',
            price: 150000,
            created_at: '2026-05-14T00:00:00Z',
          },
        ],
        total: 1,
        limit: 25,
        offset: 0,
        has_more: false,
      }),
    });
    global.fetch = fetchMock as any;
  });

  it('does not show the empty state when the backend returns visible properties', async () => {
    render(<ListingsPage />);

    expect(await screen.findByText('Visible Rightmove')).toBeInTheDocument();
    const requestedUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(requestedUrl).toMatch(/^\/api\/properties\?/);
    expect(screen.queryByText('No properties match these filters.')).not.toBeInTheDocument();
    expect(screen.queryByText('No properties found')).not.toBeInTheDocument();
    expect(screen.getByText('1-1')).toBeInTheDocument();
  });

  it('does not present backend fetch failures as zero matching properties', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => 'backend_unconfigured',
    });

    render(<ListingsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to load property listings/i);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('No properties match these filters.')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('defaults to a non-filtering listing sort instead of Top Deals', async () => {
    mockCurrentParams = new URLSearchParams('');

    render(<ListingsPage />);

    expect(await screen.findByText('Visible Rightmove')).toBeInTheDocument();
    const requestedUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(requestedUrl).toMatch(/^\/api\/properties\?/);
    expect(requestedUrl).toContain('sort=created_at_desc');
    expect(requestedUrl).not.toContain('high_confidence_top_deals=1');
    expect(mockReplace).toHaveBeenCalledWith('/listings?sort=created_at_desc');
  });

  it('updates URL sort, removes legacy dir, resets offset, and closes the menu', async () => {
    mockCurrentParams = new URLSearchParams('sort=price_asc&dir=asc&offset=50');
    render(<ListingsPage />);

    await screen.findByText('Visible Rightmove');
    fireEvent.click(screen.getByTestId('onboarding-sort-select'));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Highest ROI' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    const pushedUrl = String(mockPush.mock.calls.at(-1)?.[0] ?? '');
    expect(pushedUrl).toContain('sort=roi_desc');
    expect(pushedUrl).toContain('offset=0');
    expect(pushedUrl).not.toContain('dir=');
    expect(screen.queryByRole('menu', { name: 'Sort listings' })).not.toBeInTheDocument();
  });

  it('selects AI Recommended from the sort menu', async () => {
    render(<ListingsPage />);

    await screen.findByText('Visible Rightmove');
    fireEvent.click(screen.getByTestId('onboarding-sort-select'));
    fireEvent.pointerDown(screen.getByRole('menuitemradio', { name: 'AI Recommended' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    const pushedUrl = String(mockPush.mock.calls.at(-1)?.[0] ?? '');
    expect(pushedUrl).toContain('sort=recommended');
    expect(pushedUrl).toContain('offset=0');
  });

  it('requests high-confidence backend pagination for Top Deals', async () => {
    mockCurrentParams = new URLSearchParams('sort=top_deals&offset=25');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'strong-1',
            title: 'Strong Top Deal',
            source: 'zoopla',
            price: 175000,
            created_at: '2026-05-14T00:00:00Z',
            top_deal_tier: 'strong',
            top_deal_score: 72,
          },
        ],
        total: 30,
        limit: 25,
        offset: 25,
        has_more: false,
      }),
    });

    render(<ListingsPage />);

    expect(await screen.findByText('Strong Top Deal')).toBeInTheDocument();
    const requestedUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(requestedUrl).toMatch(/^\/api\/properties\?/);
    expect(requestedUrl).toContain('sort=top_deals');
    expect(requestedUrl).toContain('offset=25');
    expect(requestedUrl).toContain('high_confidence_top_deals=1');
    expect(screen.queryByText('No high-confidence Top Deals surfaced in this search yet.')).not.toBeInTheDocument();
  });

  it('hides user_submitted rows from the public listings grid by default', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'manual-1',
            title: 'Manual Uploaded Deal',
            source: 'user_submitted',
            price: 170000,
            created_at: '2026-06-25T00:00:00Z',
          },
          {
            id: 'public-1',
            title: 'Visible Rightmove',
            source: 'rightmove',
            price: 150000,
            created_at: '2026-06-25T00:00:00Z',
          },
        ],
        total: 2,
        limit: 25,
        offset: 0,
        has_more: false,
      }),
    });

    render(<ListingsPage />);

    expect(await screen.findByText('Visible Rightmove')).toBeInTheDocument();
    expect(screen.queryByText('Manual Uploaded Deal')).not.toBeInTheDocument();
  });
});
