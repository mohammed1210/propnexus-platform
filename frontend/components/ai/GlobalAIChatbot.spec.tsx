import { render, screen } from '@testing-library/react';

import GlobalAIChatbot from '@/components/ai/GlobalAIChatbot';

const mockUsePathname = jest.fn();

jest.mock('next/dynamic', () => () => {
  const MockAIChatbot = require('@/components/ai/AIChatbot').default;
  return MockAIChatbot;
});

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock('@/components/ai/CurrentPropertyContext', () => ({
  useCurrentProperty: () => ({ property: null }),
}));

jest.mock('@/components/ai/AIChatbot', () => ({
  __esModule: true,
  default: () => <div>Ask AI widget</div>,
}));

describe('GlobalAIChatbot', () => {
  it('hides the floating Ask AI widget on /analyse', () => {
    mockUsePathname.mockReturnValue('/analyse');
    render(<GlobalAIChatbot />);
    expect(screen.queryByText('Ask AI widget')).not.toBeInTheDocument();
  });

  it('hides the floating Ask AI widget on locale-prefixed analyse routes', () => {
    mockUsePathname.mockReturnValue('/en/analyse');
    render(<GlobalAIChatbot />);
    expect(screen.queryByText('Ask AI widget')).not.toBeInTheDocument();
  });

  it('renders the widget on non-analyse pages', () => {
    mockUsePathname.mockReturnValue('/listings');
    render(<GlobalAIChatbot />);
    expect(screen.getByText('Ask AI widget')).toBeInTheDocument();
  });
});
