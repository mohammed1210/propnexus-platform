import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import RentalEvidencePanel from './RentalEvidencePanel';

describe('RentalEvidencePanel', () => {
  it('renders real rental comp evidence without using estimates', () => {
    render(
      <RentalEvidencePanel
        intel={{
          current_monthly_rent: 1250,
          rent_evidence: { is_real_rent_evidence: true, source: 'real_rental_listing_evidence' },
          rent_comp_count: 3,
          rent_comp_median: 1275,
          rent_comp_range_low: 1200,
          rent_comp_range_high: 1350,
          rent_comp_confidence: 'moderate',
          rent_comps: [
            { title: 'Nearby rental flat', rent_monthly: 1275, bedrooms: 2, postcode: 'LS1', property_type: 'Flat', source: 'internal_property_listings' },
          ],
        }}
      />,
    );

    expect(screen.getByText('Moderate evidence')).toBeInTheDocument();
    expect(screen.getByText('Nearby rental flat')).toBeInTheDocument();
    expect(screen.getAllByText('£1,275/mo').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Derived rent estimate/i)).not.toBeInTheDocument();
  });

  it('labels derived rent estimates without showing comp cards', () => {
    render(
      <RentalEvidencePanel
        intel={{
          current_monthly_rent: 1100,
          rent_evidence: { is_real_rent_evidence: false, source: 'derived_internal_estimate', quality: 'estimate_only' },
          rent_comps: [],
        }}
      />,
    );

    expect(screen.getByText('Derived rent estimate')).toBeInTheDocument();
    expect(screen.getByText(/No verified rental comparable set is currently available/i)).toBeInTheDocument();
    expect(screen.queryByText('Derived estimate')).not.toBeInTheDocument();
  });

  it('shows missing rental evidence state', () => {
    render(<RentalEvidencePanel intel={{ rent_evidence: { source: 'unavailable', is_real_rent_evidence: false } }} />);

    expect(screen.getByText('Rental evidence unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Offer targets are intentionally withheld/i)).toBeInTheDocument();
  });
});
