import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import PricingPage from '@/app/pricing/page';

describe('PricingPage', () => {
  it('renders paywall CTA buttons', () => {
    render(<PricingPage />);

    // What users can see (matches your current markup)
    const ctas = screen.getAllByRole('button', { name: /start 7-day free trial/i });
    expect(ctas.length).toBeGreaterThan(0);

    // Also confirm upgrade intent via aria-label (your buttons include this)
    const upgradeAria = screen.getAllByRole('button', { name: /sign in to upgrade/i });
    expect(upgradeAria.length).toBeGreaterThan(0);
  });
});