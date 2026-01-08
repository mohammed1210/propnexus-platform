import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import PricingPage from '@/app/pricing/page';

describe('PricingPage', () => {
  it('renders paywall CTA buttons', () => {
    render(<PricingPage />);

    // Your buttons are labelled "Start 7-Day Free Trial"
    const ctas = screen.getAllByRole('button', { name: /start 7-day free trial/i });
    expect(ctas.length).toBeGreaterThan(0);

    // Also validates the accessibility label you set
    const upgradeAria = screen.getAllByRole('button', { name: /sign in to upgrade/i });
    expect(upgradeAria.length).toBeGreaterThan(0);
  });
});
