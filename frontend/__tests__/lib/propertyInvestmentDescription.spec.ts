import { buildInvestmentDescription } from '@/lib/propertyInvestmentDescription';

describe('buildInvestmentDescription', () => {
  it('uses scraped signals without repeating headline metrics in the paragraph', () => {
    const result = buildInvestmentDescription({
      title: 'Detached family home',
      location: 'Forest Road, Ilford',
      propertyType: 'Detached house',
      bedrooms: 4,
      bathrooms: 2,
      price: 650000,
      yieldPercent: 6.4,
      roiPercent: 2.4,
      roiIsProxy: true,
      aiScore: 72,
      dealQuality: 'Promising',
      strategyFit: 'BTL',
      description:
        'Key features • Offered Chain Free • Minutes From Fairlop Tube Station • Large rear garden • Potential to extend subject to planning.',
    });

    expect(result.paragraph).toContain('4-bedroom detached house');
    expect(result.paragraph).toContain('appears best suited to a value-add investor');
    expect(result.paragraph).toContain('chain-free status');
    expect(result.paragraph).not.toContain('£650,000');
    expect(result.paragraph).not.toContain('6.4% yield');
    expect(result.paragraph).not.toContain('2.4% ROI proxy');
    expect(result.paragraph).not.toContain('72/100 AI score');
    expect(result.cards).toHaveLength(3);
    expect(result.cards[0]).toMatchObject({ title: 'Best suited for', value: 'Value-add' });
    expect(result.cards[1].value).toContain('Chain-free status');
    expect(result.keySignals.length).toBeLessThanOrEqual(4);
    expect(result.keySignals).not.toContain('6.4% yield');
    expect(result.checks).toContain('Validate achievable rent against nearby rental evidence.');
    expect(result.originalNotes).toContain('Offered Chain Free');
    expect(result.paragraph.toLowerCase()).not.toContain('guaranteed');
    expect(result.paragraph).not.toContain('source-listing');
    expect(result.paragraph).not.toContain('true roi');
    expect(result.paragraph).not.toContain('deal quality reads');
  });

  it('falls back to structured facts when description and AI metrics are limited', () => {
    const result = buildInvestmentDescription({
      location: 'Leeds',
      propertyType: 'Terraced house',
      bedrooms: 2,
      dealQuality: 'Caution',
      strategyFit: 'Cautious review',
    });

    expect(result.paragraph).toContain('2-bedroom terraced house');
    expect(result.paragraph).toContain('appears best suited to a buy-to-let investor');
    expect(result.paragraph).toContain('available listing evidence is limited');
    expect(result.keySignals).toEqual([]);
    expect(result.checks).toContain('Validate achievable rent against nearby rental evidence.');
    expect(result.originalNotes).toBe('');
  });
});
