import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';

import PropertyCard from '@/components/PropertyCard';

jest.mock('next/link', () => {
  return ({ children }: any) => children;
});

jest.mock('next/image', () => {
  // Minimal Next/Image mock for Jest
  return function Image(props: any) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt ?? ''} />;
  };
});

describe('PropertyCard source badge', () => {
  it('uses purple badge for Zoopla', () => {
    render(
      <PropertyCard
        p={{
          id: '1',
          title: 'Test',
          source: 'zoopla',
          location: 'London',
          price: 100000,
        }}
      />,
    );

    const badge = screen.getByText('Zoopla');
    expect(badge).toHaveClass('bg-purple-100');
  });

  it('uses turquoise badge for Rightmove', () => {
    render(
      <PropertyCard
        p={{
          id: '2',
          title: 'Test',
          source: 'rightmove',
          location: 'London',
          price: 100000,
        }}
      />,
    );

    const badge = screen.getByText('Rightmove');
    expect(badge).toHaveClass('bg-teal-100');
  });

  it('uses maroon-ish badge for OTM', () => {
    render(
      <PropertyCard
        p={{
          id: '3',
          title: 'Test',
          source: 'onthemarket',
          location: 'London',
          price: 100000,
        }}
      />,
    );

    const badge = screen.getByText('OTM');
    expect(badge).toHaveClass('bg-rose-100');
  });

  it('renders trust badge chips from badges metadata', () => {
    render(
      <PropertyCard
        p={{
          id: '4',
          title: 'Test',
          source: 'rightmove',
          location: 'London',
          price: 100000,
          badges: ['rightmove', 'floorplan', 'agent-photo'],
        }}
      />,
    );

    expect(screen.getByText(/floorplan/i)).toBeInTheDocument();
    expect(screen.getByText(/agent photo/i)).toBeInTheDocument();
  });

  it('renders calibrated Deal Finder copy and mapped reasons', () => {
    render(
      <PropertyCard
        p={{
          id: '5',
          title: 'Reduced terrace',
          source: 'rightmove',
          location: 'Liverpool',
          price: 125000,
          top_deal_score: 78,
          top_deal_tier: 'prime',
          top_deal_reasons: [
            'Asking price is 20% below local sold-comps median',
            'Portal search marked it as reduced',
          ],
          top_deal: {
            evidence: {
              sold_comps: { count: 4, discount_vs_comps_pct: 20 },
            },
          },
        }}
      />,
    );

    expect(screen.getByText(/Deal Finder · Prime candidate/i)).toBeInTheDocument();
    expect(screen.getByText(/Prime · 78/i)).toBeInTheDocument();
    expect(screen.getByText(/Below local sold comps/i)).toBeInTheDocument();
    expect(screen.getByText(/Price reduction found/i)).toBeInTheDocument();
  });

  it('filters unsupported BMV claims and maps auction wording on cards', () => {
    render(
      <PropertyCard
        p={{
          id: '6',
          title: 'Auction terrace',
          source: 'rightmove',
          location: 'Liverpool',
          price: 125000,
          top_deal_score: 62,
          top_deal_tier: 'strong',
          top_deal_reasons: ['BMV bargain', 'Auction wording detected'],
        }}
      />,
    );

    expect(screen.queryByText(/BMV bargain/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Watchlist lead/i)).toBeInTheDocument();
    expect(screen.getByText(/Auction route/i)).toBeInTheDocument();
  });

  it('does not show a prominent Deal Finder block for very low scores', () => {
    render(
      <PropertyCard
        p={{
          id: '7',
          title: 'Weak lead',
          source: 'rightmove',
          location: 'Liverpool',
          price: 125000,
          top_deal_score: 26,
          top_deal_reasons: ['Auction wording detected'],
        }}
      />,
    );

    expect(screen.queryByText(/Deal Finder ·/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Low-confidence signal: check manually/i)).toBeInTheDocument();
  });

  it('labels 35 to 54 scores as a light signal', () => {
    render(
      <PropertyCard
        p={{
          id: '8',
          title: 'Light lead',
          source: 'rightmove',
          location: 'Liverpool',
          price: 125000,
          top_deal_score: 42,
          top_deal_reasons: ['Guide price', 'Chain-free'],
        }}
      />,
    );

    expect(screen.getByText(/Deal Finder · Light signal/i)).toBeInTheDocument();
    expect(screen.getByText(/Needs checks · 42/i)).toBeInTheDocument();
    expect(screen.getByText(/Negotiation angle/i)).toBeInTheDocument();
    expect(screen.getByText(/Cleaner purchase path/i)).toBeInTheDocument();
  });
});
