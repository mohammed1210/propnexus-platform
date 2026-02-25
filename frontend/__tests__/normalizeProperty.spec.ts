import {
  formatPercent,
  getRoiPercent,
  getYieldPercent,
  normalizeProperty,
  parseMoney,
  parsePercent,
} from '@/lib/normalizeProperty';

describe('normalizeProperty parsing + drift', () => {
  it('parsePercent("8.9%") -> 8.9', () => {
    expect(parsePercent('8.9%')).toBeCloseTo(8.9, 5);
  });

  it('parseMoney("£700,000") -> 700000', () => {
    expect(parseMoney('£700,000')).toBe(700000);
  });

  it('computes yieldPercent from rent+price when missing', () => {
    const p = normalizeProperty({ price: '£100,000', rent_pcm: '£1,000 pcm' } as any);
    expect(p.yieldPercent).not.toBeNull();
    expect(p.yieldPercent as number).toBeCloseTo(12.0, 3);
  });

  it('uses yield as ROI proxy when ROI missing', () => {
    const p = normalizeProperty({ price: '£800,000', rent_monthly: '£4,500 pcm' } as any);
    expect(p.yieldPercent).toBeTruthy();
    expect(p.roiPercent).toBeNull();
    expect(p.roiProxyPercent).toBeTruthy();
    expect(p.roiIsProxy).toBe(true);
    // By design, ROI proxy falls back to yield when real ROI is missing
    expect(Number(p.roiProxyPercent?.toFixed(2))).toEqual(Number(p.yieldPercent?.toFixed(2)));
  });

  it('accepts drifted yield_percent as string percent', () => {
    const p = normalizeProperty({ yield_percent: '7.5%' } as any);
    expect(p.yieldPercent).toBeCloseTo(7.5, 5);
  });

  it('falls back to score_breakdown.inputs for yield/roi/rent', () => {
    const p = normalizeProperty({
      price: 200000,
      score_breakdown: {
        inputs: {
          rent_monthly: 1000,
          yield_percent: 6,
          roi_percent: 12,
        },
      },
    } as any);

    expect(p.rentMonthly).toBe(1000);
    expect(p.yieldPercent).toBeCloseTo(6, 5);
    expect(p.roiPercent).toBeCloseTo(12, 5);
  });

  it('computes proxy yield when yield missing but score_breakdown.inputs has rent_monthly', () => {
    const p = normalizeProperty({
      price: 100000,
      score_breakdown: {
        inputs: {
          rent_monthly: 900,
        },
      },
    } as any);

    expect(p.yieldPercent).toBeCloseTo(10.8, 3);
  });
});

describe('canonical Yield/ROI helpers', () => {
  it('top-level yield_percent wins over score_breakdown.inputs', () => {
    const p: any = {
      price: 200000,
      yield_percent: 5.0,
      score_breakdown: { inputs: { yield_percent: 7.5, rent_monthly: 2000 } },
    };
    expect(getYieldPercent(p)).toBeCloseTo(5.0, 5);
  });

  it('uses score_breakdown.inputs.yield_percent if top-level missing', () => {
    const p: any = {
      price: 200000,
      yield_percent: null,
      score_breakdown: { inputs: { yield_percent: 6.1 } },
    };
    expect(getYieldPercent(p)).toBeCloseTo(6.1, 5);
    expect(formatPercent(getYieldPercent(p))).toBe('6.1%');
  });

  it('computes proxy yield from rent_monthly + price if still missing', () => {
    const p: any = { price: 100000, rent_monthly: 1000 };
    // (1000 * 12 / 100000) * 100 = 12.0
    expect(getYieldPercent(p)).toBeCloseTo(12.0, 5);
  });

  it('falls back to proxy yield/roi from rent_monthly + price when missing', () => {
    const p = normalizeProperty({
      price: 100000,
      rent_monthly: 1000,
      yield_percent: null,
      roi_percent: null,
    } as any);
    expect(getYieldPercent(p as any)).toBeCloseTo(12.0, 1);
    expect(getRoiPercent(p as any)).toBeCloseTo(12.0, 1);
  });

  it('returns null if inputs are unusable', () => {
    expect(getYieldPercent({} as any)).toBeNull();
    expect(getRoiPercent({} as any)).toBeNull();
    expect(formatPercent(null)).toBe('N/A');
  });

  it('ROI falls back to score_breakdown.inputs then proxy yield', () => {
    const fromScore: any = { score_breakdown: { inputs: { roi_percent: 9.4 } } };
    expect(getRoiPercent(fromScore)).toBeCloseTo(9.4, 5);

    const proxy: any = { price: 150000, rent_monthly: 900 };
    expect(getRoiPercent(proxy)).toBeCloseTo(7.2, 5);
  });
});
