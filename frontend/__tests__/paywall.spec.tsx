import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import PricingPage from '@/app/pricing/page';

describe('PricingPage', () => {
  it('renders paywall CTA buttons', () => {
    render(<PricingPage />);

    const ctas = screen.getAllByRole("button", { name: /sign in to upgrade/i });
    expect(ctas.length).toBeGreaterThan(0);

    expect(screen.getAllByText(/start 7-day free trial/i).length).toBeGreaterThan(0);
  });
});
