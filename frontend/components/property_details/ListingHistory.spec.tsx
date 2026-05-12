import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import ListingHistory from './ListingHistory';

describe('ListingHistory', () => {
  it('shows honest no-movement state', () => {
    render(<ListingHistory property={{ price: 200000, initial_price: 200000, first_seen_at: '2026-05-01T00:00:00Z', price_history: [] }} />);

    expect(screen.getByText('No verified price movement recorded since PropNexus began tracking this listing.')).toBeInTheDocument();
  });

  it('shows price movement timeline and total reduction', () => {
    render(<ListingHistory property={{ price: 180000, initial_price: 200000, first_seen_at: '2026-05-01T00:00:00Z', price_history: [{ old_price: 200000, new_price: 180000, direction: 'reduction', changed_at: '2026-05-10T00:00:00Z' }] }} />);

    expect(screen.getByText('10.0%')).toBeInTheDocument();
    expect(screen.getAllByText(/£200,000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/£180,000/).length).toBeGreaterThan(0);
  });
});
