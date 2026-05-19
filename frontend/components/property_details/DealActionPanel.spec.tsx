/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import AIChatbot from '@/components/ai/AIChatbot';
import DealActionPanel from '@/components/property_details/DealActionPanel';
import { getOriginalListingUrl } from '@/lib/propertyDealActions';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  isAuthEnabled: false,
}));

jest.mock('@/lib/flags', () => ({
  FF: { AI_CHAT: false },
}));

jest.mock('@/lib/api', () => ({
  postAIChat: jest.fn(),
}));

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReturnValue(new Promise(() => {}));
  global.fetch = fetchMock as any;
  Object.assign(navigator, {
    clipboard: {
      writeText: jest.fn().mockResolvedValue(undefined),
    },
  });
});

describe('DealActionPanel', () => {
  it('renders original listing button with source_url', () => {
    render(
      <DealActionPanel
        propertyId="prop-1"
        property={{ source_url: 'https://www.rightmove.co.uk/properties/123', source: 'rightmove' }}
      />,
    );

    const link = screen.getByRole('link', { name: /view on rightmove/i });
    expect(link).toHaveAttribute('href', 'https://www.rightmove.co.uk/properties/123');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders a valid external listing link in compact mode', () => {
    render(
      <DealActionPanel
        compact
        propertyId="prop-1"
        property={{ source_url: 'https://www.onthemarket.com/details/123', source: 'onthemarket' }}
      />,
    );

    const link = screen.getByRole('link', { name: /view on onthemarket/i });
    expect(link).toHaveAttribute('href', 'https://www.onthemarket.com/details/123');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('does not render original listing button without a URL', () => {
    render(<DealActionPanel propertyId="prop-1" property={{ title: 'No source listing' }} />);

    expect(screen.queryByRole('link', { name: /view original listing|view on/i })).not.toBeInTheDocument();
  });

  it('rejects unsafe listing URLs', () => {
    expect(getOriginalListingUrl({ source_url: 'javascript:alert(1)' })).toBeNull();
    expect(getOriginalListingUrl({ listing_url: 'data:text/html,hello' })).toBeNull();
    expect(getOriginalListingUrl({ url: '/relative/path' })).toBeNull();
  });

  it('builds enquiry copy with title, location, and price', async () => {
    render(
      <DealActionPanel
        propertyId="prop-1"
        property={{
          title: '2-bed terrace',
          location: 'Leeds LS1',
          price: 250000,
          source_url: 'https://www.zoopla.co.uk/for-sale/details/123',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /copy enquiry/i }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const copied = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
    expect(copied).toContain('2-bed terrace');
    expect(copied).toContain('Leeds LS1');
    expect(copied).toContain('£250,000');
  });

  it('shows contact fallback when only source URL exists', () => {
    render(
      <DealActionPanel
        propertyId="prop-1"
        property={{ source_url: 'https://www.onthemarket.com/details/123' }}
      />,
    );

    expect(screen.getAllByText('Contact via original listing').length).toBeGreaterThan(0);
    expect(screen.getByText(/verified source listing/i)).toBeInTheDocument();
  });

  it('loads current status and updates through the saved-deals status API', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deals: [{ id: 'deal-1', property_id: 'prop-1', deal_status: 'viewing_booked' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: [{ property_id: 'prop-1', deal_status: 'contacted' }] }),
      });

    render(<DealActionPanel propertyId="prop-1" property={{ title: 'Tracked deal' }} />);

    const select = await screen.findByLabelText(/contact status/i);
    expect(select).toHaveValue('viewing_booked');

    fireEvent.change(select, { target: { value: 'contacted' } });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/saved-deals/status',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ property_id: 'prop-1', status: 'contacted' }),
        }),
      ),
    );
  });
});

describe('AIChatbot floating button placement', () => {
  it('does not render with the same desktop right offset as the sidebar', () => {
    const { container } = render(<AIChatbot property={{ id: 'prop-1' } as any} />);

    const floatingRoot = container.querySelector('.fixed');
    expect(floatingRoot).toHaveClass('lg:right-[280px]');
    expect(floatingRoot).not.toHaveClass('right-4');
  });
});
