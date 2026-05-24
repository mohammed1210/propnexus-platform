import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import DealLabelChip from '../property_details/DealLabelChip';
import DealLabelExplainer from '../property_details/DealLabelExplainer';
import DealLabelPanel from '../property_details/DealLabelPanel';
import { computeDealLabel } from '@/lib/dealLabel';

const strongEvidenceProperty = {
  title: 'Chain-free auction house with renovation scope',
  description: 'No onward chain. Guide price with scope to improve and loft conversion STPP.',
  price: 200000,
  sold_comp_benchmark: { median_price: 255000 },
  comps_count: 5,
  monthly_rent: 1400,
  previous_price: 230000,
  postcode: 'M14 5AA',
  source_url: 'https://example.com/listing/1',
  image_urls: ['one.jpg', 'two.jpg', 'three.jpg'],
};

describe('computeDealLabel', () => {
  it('scores an evidence-backed opportunity as Prime Deal or Strong Deal', () => {
    const result = computeDealLabel(strongEvidenceProperty);

    expect(['prime_deal', 'strong_deal']).toContain(result.code);
    expect(result.score).toBeGreaterThanOrEqual(68);
    expect(result.confidence).toBeGreaterThanOrEqual(40);
    expect(result.calculations.priceDiscountPct).toBeGreaterThanOrEqual(7);
    expect(result.calculations.rentEvidence).toBe('direct');
  });

  it('does not label a listing with no comps or rent as a good deal', () => {
    const result = computeDealLabel({
      title: 'Flat with limited listing data',
      price: 180000,
      postcode: 'SE1 1AA',
      image_urls: ['one.jpg'],
    });

    expect(['prime_deal', 'strong_deal']).not.toContain(result.code);
    expect(result.confidence).toBeLessThan(40);
    expect(result.mainRisks).toEqual(expect.arrayContaining(['Missing comps and rent evidence']));
  });

  it('penalises an overpriced listing against benchmark', () => {
    const result = computeDealLabel({
      price: 330000,
      sold_comp_benchmark: 280000,
      monthly_rent: 900,
      comps_count: 4,
      postcode: 'LS1 2AB',
      source_url: 'https://example.com/listing/2',
      image_urls: ['one.jpg', 'two.jpg', 'three.jpg'],
    });

    expect(result.pricePositionLabel).toMatch(/above sold benchmark/i);
    expect(result.calculations.penalties).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'More than 10% above benchmark' })]));
    expect(['prime_deal', 'strong_deal']).not.toContain(result.code);
  });

  it('shows price reduction and listing signal breakdowns', () => {
    const result = computeDealLabel(strongEvidenceProperty);
    const reductionSignal = result.signals.find((signal) => signal.key === 'price_reduction');
    const listingSignal = result.signals.find((signal) => signal.key === 'listing_signals');

    expect(result.calculations.priceReductionPct).toBeGreaterThanOrEqual(10);
    expect(reductionSignal?.points).toBeGreaterThanOrEqual(10);
    expect(listingSignal?.detail).toMatch(/Chain-free|Auction|Value-add|Extension/i);
  });

  it('normalizes weekly and annual rent strings before calculating yield', () => {
    const weeklyRent = computeDealLabel({
      price: 300000,
      sold_comp_benchmark: 310000,
      rent: '£400 pw',
      comps_count: 4,
      postcode: 'E8 1AA',
      source_url: 'https://example.com/listing/3',
      image_urls: ['one.jpg', 'two.jpg', 'three.jpg'],
    });
    const annualRent = computeDealLabel({
      price: 300000,
      sold_comp_benchmark: 310000,
      rent: '£18,000 pa',
      comps_count: 4,
      postcode: 'E8 1AA',
      source_url: 'https://example.com/listing/4',
      image_urls: ['one.jpg', 'two.jpg', 'three.jpg'],
    });

    expect(weeklyRent.calculations.monthlyRent).toBeCloseTo(1733.33, 1);
    expect(weeklyRent.calculations.grossYieldPct).toBeCloseTo(6.93, 1);
    expect(annualRent.calculations.monthlyRent).toBe(1500);
    expect(annualRent.calculations.grossYieldPct).toBeCloseTo(6, 1);
  });
});

describe('Deal label components', () => {
  it('renders the compact card chip', () => {
    render(<DealLabelChip property={strongEvidenceProperty} />);

    expect(screen.getByTestId('deal-label-chip')).toBeInTheDocument();
    expect(screen.getByText('Investor Deal Label')).toBeInTheDocument();
    expect(screen.getByText(/Deal$/)).toBeInTheDocument();
    expect(screen.getByText(/\/100/)).toBeInTheDocument();
  });

  it('renders the detail panel breakdown', () => {
    render(<DealLabelPanel property={strongEvidenceProperty} />);

    expect(screen.getByTestId('deal-label-panel')).toBeInTheDocument();
    expect(screen.getByText('Why this label?')).toBeInTheDocument();
    expect(screen.getByText('Main checks before offer')).toBeInTheDocument();
    expect(screen.getByText('Signal breakdown')).toBeInTheDocument();
    expect(screen.getByText(/not formal valuations/i)).toBeInTheDocument();
  });

  it('opens the explainer modal', () => {
    render(<DealLabelExplainer />);

    fireEvent.click(screen.getByRole('button', { name: /explain investor deal labels/i }));

    expect(screen.getByRole('dialog', { name: /how propnexus deal labels work/i })).toBeInTheDocument();
    expect(screen.getByText('Prime Deal')).toBeInTheDocument();
    expect(screen.getByText('Evidence Needed')).toBeInTheDocument();
    expect(screen.getByText(/asking price/i)).toBeInTheDocument();
  });
});
