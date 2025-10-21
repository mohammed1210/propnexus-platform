import { describe, it, expect } from '@jest/globals';
import { render } from '@testing-library/react';
import PricingPage from '@/app/pricing/page';

describe('PricingPage', () => {
  it('renders Upgrade buttons', () => {
    const { getAllByText } = render(<PricingPage />);
    expect(getAllByText(/upgrade/i).length).toBeGreaterThan(0);
  });
});
