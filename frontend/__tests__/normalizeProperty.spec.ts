import { normalizeProperty, parseMoney, parsePercent } from '@/lib/normalizeProperty';

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
});
