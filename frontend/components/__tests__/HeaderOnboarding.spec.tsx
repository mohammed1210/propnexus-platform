import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import Header from '../Header';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('next/navigation', () => {
  const actual = jest.requireActual<Record<string, unknown>>('next/navigation');
  return {
    ...actual,
    usePathname: () => '/listings',
  };
});

jest.mock('../ClerkAuthSafe', () => ({
  SafeSignedIn: function MockSafeSignedIn({ children }: { children: ReactNode }) {
    return <>{children}</>;
  },
  SafeSignedOut: function MockSafeSignedOut({ children }: { children: ReactNode }) {
    return <>{children}</>;
  },
  SafeUserButton: function MockSafeUserButton() {
    return <div data-testid="user-button" />;
  },
}));

jest.mock('../ThemeToggle', () =>
  function MockThemeToggle() {
    return <button data-testid="theme-toggle">Theme</button>;
  }
);
jest.mock('../OnboardingTour', () => function MockOnboardingTour() {
  return null;
});

describe('Header onboarding controls', () => {
  it('launches replay from header and dispatches start-tour event', () => {
    render(<Header />);

    const replayButton = screen.getByTestId('header-tour-button');
    expect(replayButton).toHaveTextContent('Replay Tour');

    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    fireEvent.click(replayButton);

    expect(
      dispatchSpy.mock.calls.some((call) => (call[0] as Event)?.type === 'propnexus:start-tour')
    ).toBe(true);
    dispatchSpy.mockRestore();
  });
});
