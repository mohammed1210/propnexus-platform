import { buildInvestmentDescription } from '@/lib/propertyDescription';

describe('buildInvestmentDescription investor memo', () => {
  it('does not repeat price, yield, ROI, or AI score in the main paragraph', () => {
    const result = buildInvestmentDescription({
      location: 'Wanstead Park Road, Ilford, IG1',
      propertyType: 'Terraced house',
      bedrooms: 3,
      price: 525000,
      yieldPercent: 6.2,
      roiPercent: 18.4,
      aiScore: 77,
      dealQuality: 'Promising',
      strategyFit: 'BTL',
      description: 'Chain free house with a garden and parking close to the station.',
    });

    expect(result.paragraph).toContain('3-bedroom terraced house');
    expect(result.paragraph).toContain('appears best suited');
    expect(result.paragraph).toMatch(/before offer/i);
    expect(result.paragraph).not.toContain('£525,000');
    expect(result.paragraph).not.toContain('6.2%');
    expect(result.paragraph).not.toContain('18.4%');
    expect(result.paragraph).not.toContain('77');
    expect(result.paragraph).not.toMatch(/AI score|ROI|yield|guaranteed|worth investors money/i);
  });

  it('prioritises works or planning checks when the listing signals value-add risk', () => {
    const result = buildInvestmentDescription({
      propertyType: 'House',
      hasSoldComps: true,
      description: 'Needs refurbishment with potential to extend subject to planning.',
    });

    expect(result.cards[0]).toMatchObject({ title: 'Best suited for', value: 'Value-add' });
    expect(result.cards[2]).toMatchObject({ title: 'Check before offer', value: 'Price works risk' });
    expect(result.checks[0]).toBe('Confirm refurbishment, planning, finance and void-cost assumptions.');
    expect(result.checks.length).toBeLessThanOrEqual(2);
  });

  it('uses Evidence-light listing when source evidence is weak', () => {
    const result = buildInvestmentDescription({
      location: 'Manchester',
      propertyType: 'Property',
      hasRentalEvidence: true,
      description: '',
    });

    expect(result.cards[1]).toMatchObject({ title: 'Opportunity', value: 'Evidence-light listing' });
    expect(result.paragraph).toContain('Listing evidence is limited');
    expect(result.paragraph).not.toMatch(/chain-free|outdoor space|transport-led demand/i);
  });
});
