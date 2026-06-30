import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

jest.mock('@/components/property_details/GatedPanel', () =>
  function MockGatedPanel({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }
);

describe('OfferIntelligence', () => {
  it('renders target price calculations from evidenced rent', async () => {
    const OfferIntelligence = require('./OfferIntelligence').default;
    render(
      <OfferIntelligence
        intel={{
        asking_price: 200000,
        current_monthly_rent: 1000,
        gross_yield_percent: 6,
        rent_evidence: { is_real_rent_evidence: true, source: 'provided' },
        offer_intelligence: {
          rent_required_at_asking: { '6': 1000, '7': 1166.67, '8': 1333.33 },
          target_purchase_price_from_rent: { '6': 200000, '7': 171429, '8': 150000 },
        },
        sold_comp_benchmark: { median_similar_price: 220000, subject_vs_median_amount: -20000, subject_vs_median_pct: -9.1, benchmark_confidence: 'limited' },
        conclusion: 'Income case improves materially below £171,429.',
        }}
      />,
    );

    expect(screen.getByText('Current asking')).toBeInTheDocument();
    expect(screen.getAllByText('£200,000').length).toBeGreaterThan(0);
    expect(screen.getByText('£171,429')).toBeInTheDocument();
    expect(screen.getByText('Income case improves materially below £171,429.')).toBeInTheDocument();
  });

  it('labels missing rent evidence without overclaiming comps', async () => {
    const OfferIntelligence = require('./OfferIntelligence').default;
    render(
      <OfferIntelligence
        intel={{
        asking_price: 200000,
        current_monthly_rent: null,
        rent_evidence: { is_real_rent_evidence: false, source: 'unavailable' },
        offer_intelligence: {
          rent_required_at_asking: { '6': 1000, '7': 1166.67, '8': 1333.33 },
          target_purchase_price_from_rent: { '6': null, '7': null, '8': null },
        },
        sold_comp_benchmark: { benchmark_confidence: 'weak' },
        conclusion: 'Insufficient rent evidence to calculate a reliable offer target.',
        }}
      />,
    );

    expect(screen.getByText('Estimate/missing — not treated as a rent comp')).toBeInTheDocument();
    expect(screen.getByText('Add verified rent evidence to unlock a reliable target offer and walk-away price.')).toBeInTheDocument();
    expect(screen.getByText('Manual deal records can still be analysed, but target offer calculations are withheld until rent/comparable evidence is available.')).toBeInTheDocument();
  });
});
