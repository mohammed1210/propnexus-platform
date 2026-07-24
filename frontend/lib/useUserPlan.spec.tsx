import { render, screen, waitFor } from '@testing-library/react';

const mockAuthState = { enabled: false };

jest.mock('@/lib/auth', () => ({
  get isAuthEnabled() {
    return mockAuthState.enabled;
  },
}));

import { useUserPlan } from '@/lib/useUserPlan';

function PlanProbe() {
  const { plan, loading, error } = useUserPlan();
  return <div>{`${plan}:${loading ? 'loading' : 'ready'}:${error ?? 'no-error'}`}</div>;
}

describe('useUserPlan', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockAuthState.enabled = false;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns Free without fetching or requiring Clerk when auth is disabled', () => {
    render(<PlanProbe />);

    expect(screen.getByText('free:ready:no-error')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('loads the investor plan from the same-origin endpoint when auth is enabled', async () => {
    mockAuthState.enabled = true;
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ plan: 'investor' }),
    });

    render(<PlanProbe />);

    await waitFor(() => expect(screen.getByText('investor:ready:no-error')).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith('/api/users/plan', expect.objectContaining({ method: 'GET' }));
  });

  it('treats an unauthenticated plan response as Free without an error', async () => {
    mockAuthState.enabled = true;
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });

    render(<PlanProbe />);

    await waitFor(() => expect(screen.getByText('free:ready:no-error')).toBeInTheDocument());
  });

  it('records network failures while safely falling back to Free', async () => {
    mockAuthState.enabled = true;
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<PlanProbe />);

    await waitFor(() => expect(screen.getByText('free:ready:network unavailable')).toBeInTheDocument());
  });
});
