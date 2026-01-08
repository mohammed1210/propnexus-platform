import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import PricingPage from '@/app/pricing/page';

describe('PricingPage', () => {
  it('renders paywall CTA buttons', () => {
    render(<PricingPage />);

    // ✅ Accessible name is aria-label="Sign in to upgrade"
    const buttons = screen.getAllByRole('button', { name: /sign in to upgrade/i });
    expect(buttons.length).toBeGreaterThan(0);

    // ✅ Also confirm the visible CTA text exists
    expect(screen.getAllByText(/start 7-day free trial/i).length).toBeGreaterThan(0);
  });
});
