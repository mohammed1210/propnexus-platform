import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import PropertyDealPackTemplate from './PropertyDealPackTemplate';
import { buildPropertyDealPackModel } from '@/lib/propertyDealPack';

describe('PropertyDealPackTemplate', () => {
  it('defaults limited-data listings to a lean single-page pack and omits placeholder-heavy sections', () => {
    const model = buildPropertyDealPackModel({
      propertyId: 'deal-lean',
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
      url: 'https://app.example/property/deal-lean',
    });

    const { container } = render(<PropertyDealPackTemplate model={model} />);

    expect(screen.getByText('Lean pack')).toBeInTheDocument();
    expect(screen.getByText('Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Highlights')).toBeInTheDocument();
    expect(screen.getByText('Financial Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Investment View')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.queryByText('Asset Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Area Context')).not.toBeInTheDocument();
    expect(container.querySelector('[data-page-count="1"]')).toBeTruthy();
    expect(container.querySelector('[data-deal-pack-section="property-details"]')).toBeFalsy();
    expect(container.querySelector('[data-deal-pack-section="area-demand"]')).toBeFalsy();
    expect(screen.queryByText(/Visual unavailable/i)).not.toBeInTheDocument();
  });

  it('renders a polished compact fallback block when the listing has no image', () => {
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
    expect(screen.getByText(/pricing, strategy, and source context remain available below/i)).toBeInTheDocument();
    expect(screen.getByText(/Review the live listing for photos/i)).toBeInTheDocument();
  });

  it('adds a second printable page only when longer narrative text genuinely needs overflow space', () => {
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

  it('renders extra overview and area sections only when meaningful supporting data exists', () => {
    const model = buildPropertyDealPackModel({
      propertyId: 'deal-full',
      property: {
        title: 'Sheffield Semi With Garage',
        location: 'Sheffield',
        description: 'Close to tram links. Near a busy high street. Strong demand from professionals.',
        property_type: 'Semi-Detached',
        investment_type: 'Buy to Let',
        bedrooms: 3,
        bathrooms: 1,
        square_footage: 1025,
        amenities: ['High street', 'Schools'],
        transport_links: ['Tram stop', 'Bus interchange'],
        tenant_type: 'Young professionals',
        area_demand: 'Consistent rental demand from hospital and university staff',
        growth_context: 'Recent regeneration and improving transport links',
      },
      price: 210000,
      yieldPercent: 6.5,
    });

    render(<PropertyDealPackTemplate model={model} />);

    expect(screen.getByText('Full pack')).toBeInTheDocument();
    expect(screen.getByText('Asset Overview')).toBeInTheDocument();
    expect(screen.getByText('Area Context')).toBeInTheDocument();
    expect(screen.getByText('1,025 sq. ft.')).toBeInTheDocument();
    expect(screen.getByText('High street, Schools')).toBeInTheDocument();
    expect(screen.getByText('Tram stop, Bus interchange')).toBeInTheDocument();
    expect(screen.getByText('Young professionals')).toBeInTheDocument();
    expect(screen.getByText(/Consistent rental demand/i)).toBeInTheDocument();
  });

  it('keeps financial details compact unless enough real underwriting inputs exist', () => {
    const leanModel = buildPropertyDealPackModel({
      propertyId: 'deal-financial-lean',
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

    const { rerender } = render(<PropertyDealPackTemplate model={leanModel} />);

    expect(screen.getByText('Financial Snapshot')).toBeInTheDocument();
    expect(screen.queryByText('Legal Fees')).not.toBeInTheDocument();

    const fullModel = buildPropertyDealPackModel({
      propertyId: 'deal-financial-full',
      property: {
        title: 'Sheffield HMO',
        location: 'Sheffield',
        property_type: 'House',
        investment_type: 'HMO',
        rent_monthly: 2400,
        legal_fees: 1800,
        sourcing_fee: 3500,
        council_tax: 'Band B',
        hmo_room_rents: '5 rooms @ £480 each',
      },
      price: 250000,
      yieldPercent: 9.4,
      roiPercent: 13.1,
    });

    rerender(<PropertyDealPackTemplate model={fullModel} />);

    expect(screen.getByText('Legal Fees')).toBeInTheDocument();
    expect(screen.getByText('Sourcing Fee')).toBeInTheDocument();
    expect(screen.getByText('Council Tax')).toBeInTheDocument();
    expect(screen.getByText('HMO Room Rents')).toBeInTheDocument();
    expect(screen.getByText('5 rooms @ £480 each')).toBeInTheDocument();
  });

  it('renders off-market and on-market badges when market status is known', () => {
    const offMarketModel = buildPropertyDealPackModel({
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

    const { rerender } = render(<PropertyDealPackTemplate model={offMarketModel} />);
    expect(screen.getAllByText('Off-Market').length).toBeGreaterThan(0);

    const onMarketModel = buildPropertyDealPackModel({
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

    rerender(<PropertyDealPackTemplate model={onMarketModel} />);
    expect(screen.getAllByText('On-Market').length).toBeGreaterThan(0);
  });
});
