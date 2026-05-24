import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuthStatusPanel from '@/components/admin/AuthStatusPanel';
import { toast } from 'sonner';

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const safePayload = {
  disableAuthRaw: 'false',
  disableAuthParsed: false,
  isAuthEnabled: true,
  isAuthEnabledClient: true,
  vercelEnv: 'production',
  commitSha: 'abc123def456',
  clerk: {
    hasPublishableKey: true,
    hasValidPublishableKey: true,
    publishableKeyHasWhitespace: false,
    hasSecretKey: true,
    hasSignInUrl: true,
    hasSignUpUrl: true,
    hasAfterSignInUrl: true,
    hasAfterSignUpUrl: false,
  },
  whoami: {
    hasUserId: true,
    hasSessionId: true,
    hasEmail: true,
  },
};

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('AuthStatusPanel', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('fetches the admin auth status endpoint and renders safe booleans', async () => {
    global.fetch = jest.fn(async () => jsonResponse(safePayload)) as any;

    render(<AuthStatusPanel />);

    await screen.findByText(/User detected:/i);

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/auth-status', { cache: 'no-store' });
    expect(screen.getByText(/Live admin-only runtime snapshot from/i)).toBeInTheDocument();
    expect(screen.getByText(/User detected:/i).closest('p')?.textContent).toContain('Yes');
    expect(screen.getByText(/Session detected:/i).closest('p')?.textContent).toContain('Yes');
    expect(screen.getByText(/Email available:/i).closest('p')?.textContent).toContain('Yes');
    expect(screen.queryByText(/User ID:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Email:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PK Prefix\/Len/i)).not.toBeInTheDocument();
  });

  it('renders an inline error instead of staying in loading state when the endpoint fails', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ error: 'not_found' }, { status: 404 })) as any;

    render(<AuthStatusPanel />);

    expect(await screen.findByText('Unable to load admin auth status.')).toBeInTheDocument();
    expect(screen.getByText('not_found')).toBeInTheDocument();
    expect(screen.queryByText(/Loading auth status/i)).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('not_found');
  });

  it('allows retrying from the Refresh button after a failed load', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'not_found' }, { status: 404 }))
      .mockResolvedValueOnce(jsonResponse(safePayload)) as any;

    render(<AuthStatusPanel />);

    expect(await screen.findByText('Unable to load admin auth status.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => expect(screen.getByText(/User detected:/i).closest('p')?.textContent).toContain('Yes'));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
