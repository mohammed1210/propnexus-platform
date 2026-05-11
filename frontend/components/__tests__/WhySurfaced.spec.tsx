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
    expect(screen.getByText(/82\/100/)).toBeInTheDocument();
    expect(screen.getAllByText(/Below local sold comps/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Price reduction found/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sold comps:/i)).toBeInTheDocument();
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

    expect(screen.getByText('Why this is not a top deal yet')).toBeInTheDocument();
    expect(screen.getByText(/Low-confidence discovery score/i)).toBeInTheDocument();
  });

  it('renders nothing when no top deal data exists', () => {
    const { container } = render(<WhySurfaced property={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
