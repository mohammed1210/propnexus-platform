import { renderHook, waitFor } from '@testing-library/react';
import { useUserPlan } from '@/lib/useUserPlan';

jest.mock('@/lib/auth', () => ({
  isAuthEnabled: true,
}));

describe('useUserPlan', () => {
  const oldFetch = global.fetch;

  afterEach(() => {
    global.fetch = oldFetch;
  });

  it('loads the current plan from /api/users/plan', async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ plan: 'investor' }),
      };
    }) as any;

    const { result } = renderHook(() => useUserPlan());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/users/plan',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      }),
    );
    expect(result.current.plan).toBe('investor');
  });
});
