import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import PropertyDealPackTemplate from './PropertyDealPackTemplate';
import { buildPropertyDealPackModel } from '@/lib/propertyDealPack';

describe('PropertyDealPackTemplate', () => {
  it('renders the premium template sections for a compact deal pack', () => {
    const model = buildPropertyDealPackModel({
      propertyId: 'deal-compact',
      property: {
        title: 'Central Leeds Apartment',
        location: 'Leeds',
        description: 'Chain free. Close to the station. Strong tenant demand.',
        property_type: 'Apartment',
        investment_type: 'Buy to Let',
        bedrooms: 2,
        bathrooms: 1,
        image_urls: ['https://images.example.com/cover.jpg'],
        rent_monthly: 1400,
      },
      price: 240000,
      yieldPercent: 7,
      roiPercent: 10.4,
      aiScore: 8.8,
      url: 'https://app.example/property/deal-compact',
    });

    const { container } = render(<PropertyDealPackTemplate model={model} />);

    expect(screen.getByText('Investor Deal Pack')).toBeInTheDocument();
    expect(screen.getByText('Deal Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Deal Highlights')).toBeInTheDocument();
    expect(screen.getByText('Investment Insight')).toBeInTheDocument();
    expect(screen.getByText('Asset Overview')).toBeInTheDocument();
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    expect(container.querySelector('[data-page-count="1"]')).toBeTruthy();
    expect(screen.queryByText('Visual unavailable')).not.toBeInTheDocument();
  });

  it('renders a polished fallback block when the listing has no image', () => {
    const model = buildPropertyDealPackModel({
      propertyId: 'deal-no-image',
      property: {
        title: 'No Image Deal',
        location: 'Bristol',
        property_type: 'House',
        investment_type: 'BRRR',
      },
      price: 190000,
    });

    render(<PropertyDealPackTemplate model={model} />);

    expect(screen.getByText('Visual unavailable')).toBeInTheDocument();
    expect(screen.getByText(/captures pricing, strategy, and source-level context/i)).toBeInTheDocument();
  });

  it('adds a second printable page for longer narratives only when needed', () => {
    const model = buildPropertyDealPackModel({
      propertyId: 'deal-long',
      property: {
        title: 'Long Narrative Deal',
        location: 'Manchester',
        description: Array.from({ length: 18 }, () =>
          'This asset combines commuter appeal, refurbishment upside, durable tenant demand, and a practical family-house layout with multiple levers still to verify during diligence.'
        ).join(' '),
        property_type: 'House',
        investment_type: 'BRRR',
        bedrooms: 4,
        bathrooms: 2,
      },
      price: 395000,
      yieldPercent: 5.4,
      roiPercent: 9.2,
      url: 'https://www.example.com/properties/investments/north-west/manchester/very-long-source-path/with-additional-context?utm_source=propnexus&utm_medium=pdf&utm_campaign=deal-pack',
    });

    const { container } = render(<PropertyDealPackTemplate model={model} />);

    expect(container.querySelector('[data-page-count="2"]')).toBeTruthy();
    expect(screen.getAllByText('Executive Summary').length).toBeGreaterThan(0);
  });
});
