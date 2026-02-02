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
});
