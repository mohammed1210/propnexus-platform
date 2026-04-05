import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import PropertyDealPackTemplate from './PropertyDealPackTemplate';
import { buildPropertyDealPackModel } from '@/lib/propertyDealPack';

describe('PropertyDealPackTemplate', () => {
  it('keeps medium listings on a single compact page and groups the print sections', () => {
    const model = buildPropertyDealPackModel({
      propertyId: 'deal-compact',
      property: {
        title: 'Central Leeds Apartment With Refreshed Interiors And Strong Commuter Appeal',
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
      url: 'https://app.example/property/deal-compact?utm_source=propnexus&utm_medium=export&utm_campaign=medium-pack-layout-check',
    });

    const { container } = render(<PropertyDealPackTemplate model={model} />);

    // Header content
    expect(screen.getAllByText('PropNexus').length).toBeGreaterThan(0);
    expect(screen.getByText('Investor Deal Pack')).toBeInTheDocument();
    // Section labels
    expect(screen.getByText('Deal Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Deal Highlights')).toBeInTheDocument();
    expect(screen.getByText('Property Details')).toBeInTheDocument();
    expect(screen.getByText('Area & Demand')).toBeInTheDocument();
    expect(screen.getByText('Financial Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Investment Insight')).toBeInTheDocument();
    expect(screen.getAllByText(/Summary/i).length).toBeGreaterThan(0);
    // Compact deal: single page
    expect(container.querySelector('[data-page-count="1"]')).toBeTruthy();
    // Print-block data attributes
    expect(container.querySelector('[data-deal-pack-section="snapshot"][data-print-block="keep"]')).toBeTruthy();
    expect(container.querySelector('[data-deal-pack-section="highlights"][data-print-block="keep"]')).toBeTruthy();
    expect(container.querySelector('[data-deal-pack-section="property-details"][data-print-block="keep"]')).toBeTruthy();
    expect(container.querySelector('[data-deal-pack-section="area-demand"][data-print-block="keep"]')).toBeTruthy();
    expect(container.querySelector('[data-deal-pack-section="financial"][data-print-block="keep"]')).toBeTruthy();
    expect(container.querySelector('[data-deal-pack-section="insight"][data-print-block="keep"]')).toBeTruthy();
    expect(container.querySelector('[data-deal-pack-section="summary"][data-print-block="keep"]')).toBeTruthy();
    // Image present — no fallback
    expect(screen.queryByText(/Visual unavailable/i)).not.toBeInTheDocument();
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

    expect(screen.getByText(/Visual unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/captures pricing, strategy, and source-level context/i)).toBeInTheDocument();
  });

  it('adds a second printable page for longer narratives only when needed', () => {
    const model = buildPropertyDealPackModel({
      propertyId: 'deal-long',
      property: {
        title:
          'Long Narrative Deal With Refurbishment Upside, Flexible Exit Routes, Family Accommodation, And Layered Demand Signals Across South Manchester',
        location: 'Manchester',
        description: Array.from({ length: 30 }, () =>
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
      url: 'https://www.example.com/properties/investments/north-west/manchester/very-long-source-path/with-additional-context/that-keeps-going/for-diligence-reviewers/who-need-full-provenance?utm_source=propnexus&utm_medium=pdf&utm_campaign=deal-pack&ref=investment-committee-pack',
    });

    const { container } = render(<PropertyDealPackTemplate model={model} />);

    expect(container.querySelector('[data-page-count="2"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-deal-pack-page]').length).toBe(2);
    expect(screen.getAllByText('Executive Summary').length).toBeGreaterThan(0);
  });

  it('renders property details section with bed/bath, type, and location', () => {
    const model = buildPropertyDealPackModel({
      propertyId: 'deal-details',
      property: {
        title: 'Sheffield Semi With Garage',
        location: 'Sheffield',
        property_type: 'Semi-Detached',
        investment_type: 'Buy to Let',
        bedrooms: 3,
        bathrooms: 1,
      },
      price: 210000,
      yieldPercent: 6.5,
    });

    render(<PropertyDealPackTemplate model={model} />);

    expect(screen.getByText('Property Details')).toBeInTheDocument();
    expect(screen.getByText('3 bed / 1 bath')).toBeInTheDocument();
    expect(screen.getAllByText('Semi-Detached').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sheffield').length).toBeGreaterThan(0);
  });

  it('renders financial section with available data and placeholder state for missing fields', () => {
    const model = buildPropertyDealPackModel({
      propertyId: 'deal-financial',
      property: {
        title: 'Manchester Flat',
        location: 'Manchester',
        property_type: 'Apartment',
        investment_type: 'Buy to Let',
        rent_monthly: 950,
        legal_fees: 1500,
      },
      price: 165000,
      yieldPercent: 6.9,
    });

    render(<PropertyDealPackTemplate model={model} />);

    expect(screen.getByText('Financial Breakdown')).toBeInTheDocument();
    // Available data rendered (may appear in multiple sections)
    expect(screen.getAllByText('£165,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£950').length).toBeGreaterThan(0);
    expect(screen.getAllByText('6.9%').length).toBeGreaterThan(0);
    // Legal fees provided
    expect(screen.getByText('£1,500')).toBeInTheDocument();
    // Missing data shows placeholder
    const pendingElements = screen.getAllByText('Awaiting source data');
    expect(pendingElements.length).toBeGreaterThan(0);
  });

  it('renders area and demand section with partial data showing placeholders cleanly', () => {
    const model = buildPropertyDealPackModel({
      propertyId: 'deal-area',
      property: {
        title: 'Birmingham BTL',
        location: 'Birmingham',
        property_type: 'Terraced',
        investment_type: 'Buy to Let',
        rent_monthly: 850,
        tenant_type: 'Young professionals',
        area_demand: 'High rental demand in the area',
      },
      price: 140000,
    });

    render(<PropertyDealPackTemplate model={model} />);

    expect(screen.getByText('Area & Demand')).toBeInTheDocument();
    expect(screen.getByText('Young professionals')).toBeInTheDocument();
    expect(screen.getByText('High rental demand in the area')).toBeInTheDocument();
    // Missing growth/crime/demographic fields still show structured placeholder
    const pendingElements = screen.getAllByText('Awaiting source data');
    expect(pendingElements.length).toBeGreaterThan(0);
  });

  it('renders off-market badge when market status is off-market', () => {
    const model = buildPropertyDealPackModel({
      propertyId: 'deal-offmarket',
      property: {
        title: 'Off Market Gem',
        location: 'Leeds',
        property_type: 'House',
        investment_type: 'Flip',
        off_market: true,
      },
      price: 180000,
    });

    render(<PropertyDealPackTemplate model={model} />);
    expect(screen.getAllByText('Off-Market').length).toBeGreaterThan(0);
  });

  it('renders on-market badge when market status is on-market', () => {
    const model = buildPropertyDealPackModel({
      propertyId: 'deal-onmarket',
      property: {
        title: 'On Market Flat',
        location: 'Bristol',
        property_type: 'Apartment',
        investment_type: 'Buy to Let',
        market_status: 'on-market',
      },
      price: 200000,
    });

    render(<PropertyDealPackTemplate model={model} />);
    expect(screen.getAllByText('On-Market').length).toBeGreaterThan(0);
  });

  it('renders financial breakdown without HMO room rents for non-HMO strategies', () => {
    const model = buildPropertyDealPackModel({
      propertyId: 'deal-btl',
      property: {
        title: 'Standard BTL Flat',
        location: 'Leeds',
        property_type: 'Apartment',
        investment_type: 'Buy to Let',
      },
      price: 200000,
    });

    render(<PropertyDealPackTemplate model={model} />);
    expect(screen.queryByText('HMO Room Rents')).not.toBeInTheDocument();
  });

  it('renders HMO room rents row for HMO investment type', () => {
    const model = buildPropertyDealPackModel({
      propertyId: 'deal-hmo',
      property: {
        title: 'Sheffield HMO',
        location: 'Sheffield',
        property_type: 'House',
        investment_type: 'HMO',
        hmo_room_rents: '5 rooms @ £450 each',
      },
      price: 250000,
    });

    render(<PropertyDealPackTemplate model={model} />);
    expect(screen.getByText('HMO Room Rents')).toBeInTheDocument();
    expect(screen.getByText('5 rooms @ £450 each')).toBeInTheDocument();
  });
});
