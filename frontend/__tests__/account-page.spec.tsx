import { render, screen } from '@testing-library/react';
import AccountPage from '@/app/account/page';

let mockPlan: 'free' | 'pro' | 'investor' = 'free';
const mockRefetchPlan = jest.fn();

jest.mock('@/lib/auth', () => ({
  isAuthEnabled: true,
}));

jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: {
      primaryEmailAddress: {
        emailAddress: 'user@example.com',
      },
    },
  }),
}));

jest.mock('@/lib/useUserPlan', () => ({
  useUserPlan: () => ({
    plan: mockPlan,
    loading: false,
    error: null,
    refetch: mockRefetchPlan,
  }),
}));

describe('/account page', () => {
  it.each([
    ['free', 'Free'],
    ['pro', 'Investor Starter'],
    ['investor', 'Investor Pro'],
  ] as const)('displays the %s backend plan as %s', (plan, label) => {
    mockPlan = plan;

    render(<AccountPage />);

    expect(screen.getByRole('heading', { name: 'Manage Subscription' })).toBeInTheDocument();
    expect(screen.getAllByRole('status', { name: `Current plan: ${label}` }).length).toBeGreaterThan(0);
  });
});
