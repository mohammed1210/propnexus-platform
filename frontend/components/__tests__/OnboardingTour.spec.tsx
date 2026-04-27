import { act, render, screen } from '@testing-library/react';

import OnboardingTour from '../OnboardingTour';

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
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
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
});
