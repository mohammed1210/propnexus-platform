import { act, render, screen } from '@testing-library/react';

import OnboardingTour from '../OnboardingTour';

const mockUpdateUser = jest.fn();
const mockUserState = {
  isLoaded: true,
  isSignedIn: true,
  user: {
    id: 'user_123',
    unsafeMetadata: {},
    publicMetadata: {},
    update: mockUpdateUser,
  },
};

jest.mock('@/lib/auth', () => ({
  isAuthEnabled: true,
}));

jest.mock('@clerk/react', () => ({
  useUser: () => mockUserState,
}));

jest.mock('next/navigation', () => {
  const actual = jest.requireActual<Record<string, unknown>>('next/navigation');
  return {
    ...actual,
    usePathname: () => '/listings',
  };
});

jest.mock('react-joyride', () => {
  function MockJoyride(props: { run?: boolean }) {
    if (!props.run) return null;
    return <div className="react-joyride__tooltip">Mock Joyride Tooltip</div>;
  }

  return {
    __esModule: true,
    Joyride: MockJoyride,
    STATUS: {
      FINISHED: 'finished',
      SKIPPED: 'skipped',
    },
  };
});

describe('OnboardingTour', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
    mockUpdateUser.mockResolvedValue({});
    mockUserState.isLoaded = true;
    mockUserState.isSignedIn = true;
    mockUserState.user = {
      id: 'user_123',
      unsafeMetadata: {},
      publicMetadata: {},
      update: mockUpdateUser,
    };
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('shows a joyride step on first run and does not render fallback when joyride tooltip exists', () => {
    render(<OnboardingTour />);

    expect(screen.getByText('Mock Joyride Tooltip')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(800);
    });

    expect(screen.queryByTestId('onboarding-fallback-bubble')).not.toBeInTheDocument();
  });

  it('does not auto-run again when the signed-in user has already seen the tour', () => {
    window.localStorage.setItem('propnexus_onboarding_seen:user_123', 'true');

    render(<OnboardingTour />);

    expect(screen.queryByText('Mock Joyride Tooltip')).not.toBeInTheDocument();
  });

  it('allows a customer to manually replay the tour after it has been seen', () => {
    window.localStorage.setItem('propnexus_onboarding_seen:user_123', 'true');

    render(<OnboardingTour />);

    expect(screen.queryByText('Mock Joyride Tooltip')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('propnexus:start-tour'));
    });

    expect(screen.getByText('Mock Joyride Tooltip')).toBeInTheDocument();
  });

  it('respects Clerk metadata when deciding whether to auto-run', () => {
    mockUserState.user = {
      ...mockUserState.user,
      unsafeMetadata: { propnexusOnboardingSeen: true },
    };

    render(<OnboardingTour />);

    expect(screen.queryByText('Mock Joyride Tooltip')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('propnexus_onboarding_seen:user_123')).toBe('true');
  });
});
