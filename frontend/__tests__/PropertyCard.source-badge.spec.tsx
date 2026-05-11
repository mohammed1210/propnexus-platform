import '@testing-library/jest-dom';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import PropertyCard from '@/components/PropertyCard';

const mockFetchWithRetry = jest.fn();
const mockAuthState = {
  isLoaded: true,
  isSignedIn: false,
  userId: null as string | null,
};

jest.mock('@/lib/api', () => ({
  fetchWithRetry: (...args: unknown[]) => mockFetchWithRetry(...args),
}));

jest.mock('@clerk/nextjs', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('next/link', () => {
  return ({ children }: any) => children;
});

jest.mock('next/image', () => {
  // Minimal Next/Image mock for Jest
  return function Image(props: any) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt ?? ''} />;
  };
});

describe('PropertyCard source badge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.userId = null;
    mockAuthState.isSignedIn = false;
    mockFetchWithRetry.mockResolvedValue({ ok: true, json: async () => ({ saved: false, deals: [] }) });
  });

  it('uses purple badge for Zoopla', () => {
    render(
      <PropertyCard
        p={{
          id: '1',
          title: 'Test',
          source: 'zoopla',
          location: 'London',
          price: 100000,
        }}
      />,
    );

    const badge = screen.getByText('Zoopla');
    expect(badge).toHaveClass('bg-purple-100');
  });

  it('uses turquoise badge for Rightmove', () => {
    render(
      <PropertyCard
        p={{
          id: '2',
          title: 'Test',
          source: 'rightmove',
          location: 'London',
          price: 100000,
        }}
      />,
    );

    const badge = screen.getByText('Rightmove');
    expect(badge).toHaveClass('bg-teal-100');
  });

  it('uses maroon-ish badge for OTM', () => {
    render(
      <PropertyCard
        p={{
          id: '3',
          title: 'Test',
          source: 'onthemarket',
          location: 'London',
          price: 100000,
        }}
      />,
    );

    const badge = screen.getByText('OTM');
    expect(badge).toHaveClass('bg-rose-100');
  });

  it('renders trust badge chips from badges metadata', () => {
    render(
      <PropertyCard
        p={{
          id: '4',
          title: 'Test',
          source: 'rightmove',
          location: 'London',
          price: 100000,
          badges: ['rightmove', 'floorplan', 'agent-photo'],
        }}
      />,
    );

    expect(screen.getByText(/floorplan/i)).toBeInTheDocument();
    expect(screen.getByText(/agent photo/i)).toBeInTheDocument();
  });

  it('renders calibrated Deal Finder copy and mapped reasons', () => {
    render(
      <PropertyCard
        p={{
          id: '5',
          title: 'Reduced terrace',
          source: 'rightmove',
          location: 'Liverpool',
          price: 125000,
          top_deal_score: 78,
          top_deal_tier: 'prime',
          top_deal_reasons: [
            'Asking price is 20% below local sold-comps median',
            'Portal search marked it as reduced',
          ],
          top_deal: {
            evidence: {
              sold_comps: { count: 4, discount_vs_comps_pct: 20 },
            },
          },
        }}
      />,
    );

    expect(screen.getByText(/Top Deal · Prime candidate/i)).toBeInTheDocument();
    expect(screen.getByText(/Prime · 78/i)).toBeInTheDocument();
    expect(screen.getByText(/Below local sold comps/i)).toBeInTheDocument();
    expect(screen.getByText(/Price reduction found/i)).toBeInTheDocument();
  });

  it('filters unsupported BMV claims and maps auction-only wording as a watchlist lead', () => {
    render(
      <PropertyCard
        p={{
          id: '6',
          title: 'Auction terrace',
          source: 'rightmove',
          location: 'Liverpool',
          price: 125000,
          top_deal_score: 62,
          top_deal_tier: 'strong',
          top_deal_reasons: ['BMV bargain', 'Auction wording detected'],
        }}
      />,
    );

    expect(screen.queryByText(/BMV bargain/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Deal Finder · Watchlist lead/i)).toBeInTheDocument();
    expect(screen.queryByText(/Top Deal/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Auction route/i)).toBeInTheDocument();
  });

  it('does not show Deal Finder copy for scores below 45', () => {
    render(
      <PropertyCard
        p={{
          id: '7',
          title: 'Weak lead',
          source: 'rightmove',
          location: 'Liverpool',
          price: 125000,
          top_deal_score: 26,
          top_deal_reasons: ['Auction wording detected'],
        }}
      />,
    );

    expect(screen.queryByText(/Deal Finder ·/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Low-confidence signal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Early signal/i)).not.toBeInTheDocument();
  });

  it('renders 45 to 54 scores as a subtle early signal', () => {
    render(
      <PropertyCard
        p={{
          id: '8',
          title: 'Light lead',
          source: 'rightmove',
          location: 'Liverpool',
          price: 125000,
          top_deal_score: 48,
          top_deal_reasons: ['Guide price', 'Chain-free'],
        }}
      />,
    );

    expect(screen.getByText(/Early signal — needs validation/i)).toBeInTheDocument();
    expect(screen.queryByText(/48/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Top Deal/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Negotiation angle/i)).toBeInTheDocument();
  });

  it('checks exact saved state and shows Save when this card is not saved', async () => {
    mockAuthState.userId = 'user-1';
    mockAuthState.isSignedIn = true;
    mockFetchWithRetry.mockResolvedValueOnce({ ok: true, json: async () => ({ saved: false, deals: [{ property_id: 'other' }] }) });

    render(<PropertyCard p={{ id: 'save-1', title: 'Save me', source: 'rightmove', price: 100000 }} />);

    await waitFor(() => expect(mockFetchWithRetry).toHaveBeenCalledWith('/api/saved-deals?property_id=save-1', { cache: 'no-store' }));
    expect(screen.getByRole('button', { name: /save this property/i })).toBeInTheDocument();
  });

  it('shows Saved when the exact card property is saved', async () => {
    mockAuthState.userId = 'user-1';
    mockAuthState.isSignedIn = true;
    mockFetchWithRetry.mockResolvedValueOnce({ ok: true, json: async () => ({ saved: true, deals: [{ property_id: 'save-2' }] }) });

    render(<PropertyCard p={{ id: 'save-2', title: 'Saved card', source: 'rightmove', price: 100000 }} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /remove saved property/i })).toBeInTheDocument());
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('can remove a saved card property', async () => {
    mockAuthState.userId = 'user-1';
    mockAuthState.isSignedIn = true;
    mockFetchWithRetry
      .mockResolvedValueOnce({ ok: true, json: async () => ({ saved: true, deals: [{ property_id: 'save-3' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    render(<PropertyCard p={{ id: 'save-3', title: 'Remove card', source: 'rightmove', price: 100000 }} />);

    const button = await screen.findByRole('button', { name: /remove saved property/i });
    fireEvent.click(button);

    await waitFor(() => expect(mockFetchWithRetry).toHaveBeenCalledWith('/api/saved-deals?property_id=save-3', expect.objectContaining({ method: 'DELETE' })));
    await waitFor(() => expect(screen.getByRole('button', { name: /save this property/i })).toBeInTheDocument());
  });

  it('does not mark all cards saved when an unrelated saved deal is returned', async () => {
    mockAuthState.userId = 'user-1';
    mockAuthState.isSignedIn = true;
    mockFetchWithRetry.mockResolvedValueOnce({ ok: true, json: async () => ({ deals: [{ property_id: 'unrelated' }] }) });

    render(<PropertyCard p={{ id: 'current-card', title: 'Current card', source: 'rightmove', price: 100000 }} />);

    await waitFor(() => expect(mockFetchWithRetry).toHaveBeenCalledWith('/api/saved-deals?property_id=current-card', { cache: 'no-store' }));
    expect(screen.getByRole('button', { name: /save this property/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove saved property/i })).not.toBeInTheDocument();
  });
});
