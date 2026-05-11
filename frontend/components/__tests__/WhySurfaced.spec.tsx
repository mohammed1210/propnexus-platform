import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import WhySurfaced from '../property_details/WhySurfaced';

describe('WhySurfaced', () => {
  it('renders top deal score and evidence-backed reasons', () => {
    render(
      <WhySurfaced
        property={{
          top_deal_score: 82,
          top_deal_tier: 'prime',
          top_deal_reasons: [
            'Asking price is 20% below local sold-comps median',
            'Portal search marked it as reduced',
          ],
        }}
      />,
    );

    expect(screen.getByText('Why PropNexus surfaced this')).toBeInTheDocument();
    expect(screen.getByText(/82\/100/)).toBeInTheDocument();
    expect(screen.getByText(/sold-comps median/i)).toBeInTheDocument();
  });

  it('does not render unsupported BMV claims without comps wording', () => {
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
    expect(screen.getByText(/Auction wording detected/i)).toBeInTheDocument();
  });

  it('renders nothing when no top deal data exists', () => {
    const { container } = render(<WhySurfaced property={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
