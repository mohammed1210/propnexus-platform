import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import GatedPanel from '../property_details/GatedPanel';
import { useUserPlan } from '@/lib/useUserPlan';

jest.mock('@/lib/useUserPlan', () => ({
  useUserPlan: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  isAuthEnabled: true,
}));

jest.mock('@/components/LockedFeature', () => {
  return function MockLockedFeature({
    title,
    message,
    children,
    showPreview,
  }: {
    title: string;
    message?: string;
    children?: ReactNode;
    showPreview?: boolean;
  }) {
    return (
      <div data-testid="locked-feature">
        <div>{title}</div>
        <div>{message}</div>
        {showPreview && children ? <div data-testid="locked-preview">{children}</div> : null}
      </div>
    );
  };
});

const mockUseUserPlan = useUserPlan as jest.MockedFunction<typeof useUserPlan>;

describe('GatedPanel entitlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows unlocked AI Deal Score content for entitled users', () => {
    mockUseUserPlan.mockReturnValue({
      plan: 'pro',
      loading: false,
      error: null,
      refetch: async () => undefined,
    });

    render(
      <GatedPanel title="AI Deal Score" requiredPlan="pro" featureEnabled={true} showPreviewWhenLocked={false}>
        <div data-testid="deal-score-content">Deal score content</div>
      </GatedPanel>,
    );

    expect(screen.getByTestId('deal-score-content')).toBeInTheDocument();
    expect(screen.queryByTestId('locked-feature')).not.toBeInTheDocument();
  });

  it('shows locked state only for non-entitled users', () => {
    mockUseUserPlan.mockReturnValue({
      plan: 'free',
      loading: false,
      error: null,
      refetch: async () => undefined,
    });

    render(
      <GatedPanel title="AI Deal Score" requiredPlan="pro" featureEnabled={true} showPreviewWhenLocked={false}>
        <div data-testid="deal-score-content">Deal score content</div>
      </GatedPanel>,
    );

    expect(screen.getByTestId('locked-feature')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Upgrade to unlock AI Deal Score. This section is available on Investor Starter or Investor Pro. Your current plan is Free.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('deal-score-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('locked-preview')).not.toBeInTheDocument();
  });
});
