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

  it('starts as a compact alert button and expands to location-first options', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ items: [] })) as typeof fetch;

    render(
      <SaveSearchAlert
        query="Leeds"
        sort="top_deals"
        filters={{ min: 150000, max: 300000, beds: 2, baths: 1 }}
      />,
    );

    expect(screen.getByRole('button', { name: /deal alert/i })).toBeInTheDocument();
    expect(screen.queryByText('Create deal alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /deal alert/i }));

    expect(await screen.findByText('Create deal alert')).toBeInTheDocument();
    await screen.findByText('No saved alerts yet.');
    expect(screen.getByLabelText(/location/i)).toHaveValue('Leeds');
    expect(screen.getByLabelText(/beds/i)).toHaveValue('2');
    expect(screen.getByLabelText(/baths/i)).toHaveValue('1');
    expect(screen.getByLabelText(/minimum price/i)).toHaveValue(150000);
    expect(screen.getByLabelText(/maximum price/i)).toHaveValue(300000);
  });

  it('requires a location before creating an alert', async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ items: [] }));
    global.fetch = fetchMock as typeof fetch;

    render(<SaveSearchAlert query="" sort="top_deals" filters={{}} />);

    fireEvent.click(screen.getByRole('button', { name: /deal alert/i }));
    await screen.findByText('No saved alerts yet.');
    fireEvent.click(screen.getByRole('button', { name: /create alert/i }));

    expect(toast.error).toHaveBeenCalledWith('Choose a location before creating a deal alert.');
    expect(fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/investor-alerts' && init?.method === 'POST')).toBe(false);
  });

  it('creates an alert from location, bed/bath and price options, then collapses', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/investor-alerts' && init?.method === 'POST') {
        return jsonResponse({ ok: true, alert: { id: 'alert-1', label: 'Deals in Leeds', active: true } });
      }
      if (url === '/api/investor-alerts') {
        return jsonResponse({ items: [] });
      }
      return textResponse('not found', 404);
    });
    global.fetch = fetchMock as typeof fetch;

    render(<SaveSearchAlert query="" sort="top_deals" filters={{ property_type: 'terraced' }} />);

    fireEvent.click(screen.getByRole('button', { name: /deal alert/i }));
    await screen.findByText('No saved alerts yet.');
    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: 'Leeds' } });
    fireEvent.change(screen.getByLabelText(/beds/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/baths/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/minimum price/i), { target: { value: '150000' } });
    fireEvent.change(screen.getByLabelText(/maximum price/i), { target: { value: '300000' } });
    fireEvent.change(screen.getByLabelText(/digest frequency/i), { target: { value: 'weekly' } });
    fireEvent.click(screen.getByRole('button', { name: /create alert/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Deal alert created'));

    const postCall = fetchMock.mock.calls.find(([url, init]) => String(url) === '/api/investor-alerts' && init?.method === 'POST');
    expect(postCall).toBeTruthy();
    const payload = JSON.parse(String(postCall?.[1]?.body));
    expect(payload).toMatchObject({
      label: 'Deals in Leeds',
      search_query: 'Leeds',
      min_discovery_score: 60,
      include_tiers: ['prime', 'strong'],
      frequency: 'weekly',
      active: true,
    });
    expect(payload.filters).toMatchObject({
      location: 'Leeds',
      min: 150000,
      max: 300000,
      beds: 3,
      baths: 2,
      property_type: 'terraced',
      sort: 'top_deals',
    });
    expect(screen.queryByText('Create deal alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /deal alert/i })).toBeInTheDocument();
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
              search_query: 'Leeds',
              include_tiers: ['prime', 'strong'],
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

    fireEvent.click(screen.getByRole('button', { name: /deal alert/i }));
    await screen.findByText('Prime Leeds alerts');

    fireEvent.click(screen.getByTitle('Pause alert'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Alert paused'));
    const patchCall = fetchMock.mock.calls.find(([url, init]) => String(url) === '/api/investor-alerts/alert-1' && init?.method === 'PATCH');
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ active: false });
  });
});
