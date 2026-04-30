import { buildInvestmentDescription } from '@/lib/propertyInvestmentDescription';

describe('buildInvestmentDescription', () => {
  it('uses scraped signals and available metrics without making unsupported claims', () => {
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
    expect(result.paragraph).toContain('looks best suited to a buy-to-let investor');
    expect(result.paragraph).toContain('Overall, the deal looks promising on the information available.');
    expect(result.paragraph).toContain('6.4% yield');
    expect(result.paragraph).toContain('2.4% ROI proxy');
    expect(result.paragraph).toContain('72/100 AI score');
    expect(result.paragraph).toContain('The listing highlights chain-free, transport access and outdoor space.');
    expect(result.keySignals).toContain('Chain-free');
    expect(result.keySignals).toContain('Transport access');
    expect(result.checks).toContain('Confirm the true ROI after finance, works and fees.');
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
    expect(result.paragraph).toContain('looks best suited to a cautious review before offer');
    expect(result.paragraph).toContain('Yield, ROI and score data are limited');
    expect(result.keySignals).toEqual([]);
    expect(result.checks).toContain('Verify the achievable rent before underwriting.');
    expect(result.originalNotes).toBe('');
  });
});
