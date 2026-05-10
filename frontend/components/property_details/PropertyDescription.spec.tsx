/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

import PropertyDescription from '@/components/property_details/PropertyDescription';
import { buildInvestmentDescription } from '@/lib/propertyDescription';

describe('PropertyDescription investor brief', () => {
  it('renders Investor Brief with a concise non-metric paragraph', () => {
    const brief = buildInvestmentDescription({
      location: 'Forest Road, Ilford',
      propertyType: 'Detached house',
      bedrooms: 4,
      bathrooms: 2,
      price: 650000,
      yieldPercent: 6.4,
      roiPercent: 41,
      roiIsProxy: true,
      aiScore: 72,
      dealQuality: 'Promising',
      strategyFit: 'BTL',
      description:
        'Key features • Offered Chain Free • Minutes From Fairlop Tube Station • Large rear garden • Potential to extend subject to planning.',
    });

    render(<PropertyDescription brief={brief} />);

    expect(screen.getByText('Investor Brief')).toBeInTheDocument();
    expect(screen.getByText(/Generated from the listing, deal score and available market evidence/i)).toBeInTheDocument();

    const paragraph = screen.getByTestId('investor-brief-paragraph');
    expect(paragraph).toHaveTextContent('4-bedroom detached house');
    expect(paragraph).toHaveTextContent(/best suited/i);
    expect(paragraph).not.toHaveTextContent('£650,000');
    expect(paragraph).not.toHaveTextContent('6.4%');
    expect(paragraph).not.toHaveTextContent(/ROI proxy/i);
    expect(paragraph).not.toHaveTextContent('72/100');
    expect(paragraph).not.toHaveTextContent(/AI score/i);
  });

  it('renders three investor brief cards and collapses original listing notes by default', () => {
    const brief = buildInvestmentDescription({
      location: 'Leeds',
      propertyType: 'Terraced house',
      bedrooms: 2,
      strategyFit: 'BTL',
      description: 'Chain free property with a garden and scope to modernise.',
    });

    const { container } = render(<PropertyDescription brief={brief} />);

    expect(screen.getByText('Best suited for')).toBeInTheDocument();
    expect(screen.getByText('Opportunity')).toBeInTheDocument();
    expect(screen.getByText('Check before offer')).toBeInTheDocument();

    const details = container.querySelector('details');
    expect(details).toBeInTheDocument();
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText('Source listing notes')).toBeInTheDocument();
  });

  it('hides numeric duplicate chips and keeps useful non-numeric chips', () => {
    const brief = buildInvestmentDescription({
      propertyType: 'House',
      price: 450000,
      yieldPercent: 7.1,
      roiPercent: 15.2,
      aiScore: 81,
      description:
        'Chain free. Close to the station. Large garden. Potential to extend STPP. Needs refurbishment. Parking and garage. Good schools nearby. Reduced price.',
    });

    render(<PropertyDescription brief={brief} />);

    const opportunityText = screen.getByText(/may support the investment story/i).textContent ?? '';
    const chips = screen.getAllByTestId('investor-brief-chip');

    expect(chips.length).toBeLessThanOrEqual(4);
    expect(chips.length).toBeGreaterThanOrEqual(2);
    for (const chip of chips) {
      expect(opportunityText.toLowerCase()).not.toContain(chip.textContent?.toLowerCase() ?? '');
      expect(chip).not.toHaveTextContent(/£|%|ROI|AI score|yield/i);
    }
  });

  it('hides the chip row when fewer than two meaningful chips remain', () => {
    const brief = buildInvestmentDescription({
      propertyType: 'Flat',
      description: 'Chain free listing.',
    });

    render(<PropertyDescription brief={brief} />);

    expect(screen.queryByLabelText('Investor brief feature tags')).not.toBeInTheDocument();
  });

  it('renders a maximum of two checks before offer', () => {
    const brief = buildInvestmentDescription({
      propertyType: 'House',
      hasSoldComps: true,
      description: 'Potential to extend subject to planning. Needs refurbishment and modernisation.',
    });

    render(<PropertyDescription brief={brief} />);

    const checklist = screen.getByRole('list', { name: /checks before offer/i });
    expect(within(checklist).getAllByRole('listitem').length).toBeLessThanOrEqual(2);
    expect(screen.getAllByText('Confirm refurbishment, planning, finance and void-cost assumptions.').length).toBeGreaterThan(0);
  });

  it('does not create fake claims when source data is limited', () => {
    const brief = buildInvestmentDescription({
      propertyType: 'Property',
      location: 'Manchester',
      description: '',
    });

    render(<PropertyDescription brief={brief} />);

    const paragraph = screen.getByTestId('investor-brief-paragraph');
    expect(paragraph).toHaveTextContent(/Listing evidence is limited/i);
    expect(paragraph).not.toHaveTextContent(/chain-free|outdoor space|near station|sold comps/i);
    expect(screen.getByText('Evidence-light listing')).toBeInTheDocument();
  });
});
