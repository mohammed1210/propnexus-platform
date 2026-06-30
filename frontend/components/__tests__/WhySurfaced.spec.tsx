import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import WhySurfaced from '../property_details/WhySurfaced';

describe('WhySurfaced', () => {
  it('renders surfaced heading, score and mapped evidence-backed reasons', () => {
    render(
      <WhySurfaced
        property={{
          top_deal_score: 82,
          top_deal_tier: 'prime',
          top_deal_reasons: [
            'Asking price is 20% below local sold-comps median',
            'Portal search marked it as reduced',
          ],
          top_deal: {
            evidence: {
              sold_comps: { count: 4, discount_vs_comps_pct: 20 },
              rent_evidence: 'comps',
            },
          },
        }}
      />,
    );

    expect(screen.getByText('Why PropNexus surfaced this')).toBeInTheDocument();
    expect(screen.getByText(/Strong discovery signals found before deeper due diligence/i)).toBeInTheDocument();
    expect(screen.getByText(/82\/100/)).toBeInTheDocument();
    expect(screen.getAllByText(/Below local sold comps/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Price reduction found/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Comps evidence')).toBeInTheDocument();
    expect(screen.getByText(/Sold comps available/i)).toBeInTheDocument();
    expect(screen.getByText(/Discovery score ranks available deal-discovery signals, not investment suitability/i)).toBeInTheDocument();
  });

  it('does not render unsupported BMV claims without comps evidence', () => {
    render(
      <WhySurfaced
        property={{
          top_deal_score: 65,
          top_deal_tier: 'strong',
          top_deal_reasons: ['BMV bargain', 'Auction wording detected'],
        }}
      />,
    );

    expect(screen.queryByText(/BMV bargain/i)).not.toBeInTheDocument();
    expect(screen.getByText('Why this is on the watchlist')).toBeInTheDocument();
    expect(screen.getAllByText(/Auction route/i).length).toBeGreaterThan(0);
  });

  it('uses low-score copy when the discovery score is weak', () => {
    render(
      <WhySurfaced
        property={{
          top_deal_score: 34,
          top_deal_reasons: ['Auction wording detected'],
        }}
      />,
    );

    expect(screen.getAllByText('Standard listing').length).toBeGreaterThan(0);
    expect(screen.getByText(/PropNexus found limited signals/i)).toBeInTheDocument();
  });

  it('uses early signal copy and marks missing evidence explicitly', () => {
    render(
      <WhySurfaced
        property={{
          top_deal_score: 49,
          top_deal_reasons: ['Guide price'],
        }}
      />,
    );

    expect(screen.getByText('Early signal found')).toBeInTheDocument();
    expect(screen.getByText(/Listing-signal based/i)).toBeInTheDocument();
    expect(screen.getByText('Comps evidence')).toBeInTheDocument();
    expect(screen.getAllByText('Missing').length).toBeGreaterThan(0);
  });

  it('renders nothing when no top deal data exists', () => {
    const { container } = render(<WhySurfaced property={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
