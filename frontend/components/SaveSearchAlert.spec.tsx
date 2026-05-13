import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SaveSearchAlert from './SaveSearchAlert';
import { toast } from 'sonner';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function textResponse(message: string, status = 500) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ message }),
  } as Response;
}

describe('SaveSearchAlert', () => {
  const oldFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = oldFetch;
  });

  it('summarizes the active search criteria before saving', () => {
    render(
      <SaveSearchAlert
        query="Leeds"
        sort="top_deals"
        filters={{ min: 150000, max: 300000, beds: 2, baths: 1, investment_type: 'BTL', property_type: 'terraced' }}
      />,
    );

    expect(screen.getByText('Deal alert workflow')).toBeInTheDocument();
    expect(screen.getByText('Search: Leeds')).toBeInTheDocument();
    expect(screen.getByText('£150,000-£300,000')).toBeInTheDocument();
    expect(screen.getByText('2+ beds')).toBeInTheDocument();
    expect(screen.getByText('Sort: Top Deals')).toBeInTheDocument();
  });

  it('creates an alert from configured quality and frequency options', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/investor-alerts' && init?.method === 'POST') {
        return jsonResponse({ ok: true, alert: { id: 'alert-1', label: 'Deals for Leeds', active: true } });
      }
      if (url === '/api/investor-alerts') {
        return jsonResponse({ items: [] });
      }
      return textResponse('not found', 404);
    });
    global.fetch = fetchMock as typeof fetch;

    render(
      <SaveSearchAlert
        query="Leeds"
        sort="top_deals"
        filters={{ min: 150000, max: 300000, beds: 2, investment_type: 'BTL' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /configure/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Watchlist' }));
    fireEvent.change(screen.getByLabelText(/digest frequency/i), { target: { value: 'weekly' } });
    fireEvent.click(screen.getByRole('button', { name: /create alert/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Deal alert created'));

    const postCall = fetchMock.mock.calls.find(([url, init]) => String(url) === '/api/investor-alerts' && init?.method === 'POST');
    expect(postCall).toBeTruthy();
    const payload = JSON.parse(String(postCall?.[1]?.body));
    expect(payload).toMatchObject({
      label: 'Deals for Leeds',
      search_query: 'Leeds',
      min_discovery_score: 45,
      include_tiers: ['prime', 'strong', 'watchlist'],
      frequency: 'weekly',
      active: true,
    });
    expect(payload.filters).toMatchObject({ min: 150000, max: 300000, beds: 2, investment_type: 'BTL', sort: 'top_deals' });
  });

  it('loads existing alerts and can pause one', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/investor-alerts' && !init?.method) {
        return jsonResponse({
          items: [
            {
              id: 'alert-1',
              label: 'Prime Leeds alerts',
              include_tiers: ['prime', 'strong'],
              min_discovery_score: 60,
              frequency: 'daily',
              active: true,
            },
          ],
        });
      }
      if (url === '/api/investor-alerts/alert-1' && init?.method === 'PATCH') {
        return jsonResponse({ ok: true });
      }
      return textResponse('not found', 404);
    });
    global.fetch = fetchMock as typeof fetch;

    render(<SaveSearchAlert query="Leeds" sort="top_deals" filters={{}} />);

    fireEvent.click(screen.getByRole('button', { name: /configure/i }));
    await screen.findByText('Prime Leeds alerts');

    fireEvent.click(screen.getByTitle('Pause alert'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Alert paused'));
    const patchCall = fetchMock.mock.calls.find(([url, init]) => String(url) === '/api/investor-alerts/alert-1' && init?.method === 'PATCH');
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ active: false });
  });
});
