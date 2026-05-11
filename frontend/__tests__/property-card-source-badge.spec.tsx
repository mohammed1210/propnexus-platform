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

  it('renders evidence-backed top deal badge and reasons', () => {
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
        }}
      />,
    );

    expect(screen.getByText(/Top Deal · 78/i)).toBeInTheDocument();
    expect(screen.getByText(/sold-comps median/i)).toBeInTheDocument();
  });

  it('filters unsupported BMV top deal claims on cards', () => {
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
    expect(screen.getByText(/Auction wording detected/i)).toBeInTheDocument();
  });
});
