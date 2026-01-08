import React from 'react';
import { render, screen } from '@testing-library/react';
import PricingPage from '../app/pricing/page';

describe('PricingPage', () => {
  it('renders primary CTA buttons', () => {
    render(<PricingPage />);

    // Prefer what the user sees (button text)
    const ctas = screen.getAllByRole('button', { name: /start 7-day free trial/i });
    expect(ctas.length).toBeGreaterThan(0);

    // Optional: also assert aria-label path still exists (matches your current markup)
    const ariaCtas = screen.getAllByRole('button', { name: /sign in to upgrade/i });
    expect(ariaCtas.length).toBeGreaterThan(0);
  });
});
