/**
 * Tests for SDLT (Stamp Duty Land Tax) calculator
 */

import { calculateSDLT, formatGBP, getBuyerTypeLabel, type BuyerType } from '@/lib/finance/sdlt';

describe('calculateSDLT', () => {
  describe('Standard buyer', () => {
    it('should calculate 0 duty for £0 price', () => {
      const result = calculateSDLT(0, 'standard');
      expect(result.total).toBe(0);
      expect(result.baseTotal).toBe(0);
      expect(result.surcharge).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });

    it('should calculate 0 duty for price under £250k', () => {
      const result = calculateSDLT(200_000, 'standard');
      expect(result.total).toBe(0);
      expect(result.baseTotal).toBe(0);
      expect(result.surcharge).toBe(0);
    });

    it('should calculate duty for £300k', () => {
      const result = calculateSDLT(300_000, 'standard');
      // First £250k: 0%
      // Next £50k: 5% = £2,500
      expect(result.total).toBe(2_500);
      expect(result.baseTotal).toBe(2_500);
      expect(result.surcharge).toBe(0);
    });

    it('should calculate duty for £1m', () => {
      const result = calculateSDLT(1_000_000, 'standard');
      // First £250k: 0%
      // Next £675k (£250k-£925k): 5% = £33,750
      // Next £75k (£925k-£1m): 10% = £7,500
      // Total: £41,250
      expect(result.total).toBe(41_250);
      expect(result.baseTotal).toBe(41_250);
      expect(result.surcharge).toBe(0);
    });

    it('should calculate duty for £2m', () => {
      const result = calculateSDLT(2_000_000, 'standard');
      // First £250k: 0%
      // Next £675k: 5% = £33,750
      // Next £575k: 10% = £57,500
      // Next £500k: 12% = £60,000
      // Total: £151,250
      expect(result.total).toBe(151_250);
    });

    it('should handle band breakdown correctly', () => {
      const result = calculateSDLT(500_000, 'standard');
      expect(result.bands).toHaveLength(2);
      expect(result.bands[0].taxable).toBe(250_000);
      expect(result.bands[0].duty).toBe(0);
      expect(result.bands[1].taxable).toBe(250_000);
      expect(result.bands[1].duty).toBe(12_500); // 5% of £250k
    });
  });

  describe('Additional property buyer', () => {
    it('should add 3% surcharge for additional property', () => {
      const result = calculateSDLT(300_000, 'additional');
      const baseDuty = 2_500; // 5% of £50k
      const surcharge = 9_000; // 3% of £300k
      expect(result.baseTotal).toBe(baseDuty);
      expect(result.surcharge).toBe(surcharge);
      expect(result.total).toBe(baseDuty + surcharge);
      expect(result.surchargeRate).toBe(0.03);
    });

    it('should apply surcharge even when base duty is 0', () => {
      const result = calculateSDLT(200_000, 'additional');
      expect(result.baseTotal).toBe(0);
      expect(result.surcharge).toBe(6_000); // 3% of £200k
      expect(result.total).toBe(6_000);
    });
  });

  describe('Non-resident buyer', () => {
    it('should add 2% surcharge for non-resident', () => {
      const result = calculateSDLT(300_000, 'nonresident');
      const baseDuty = 2_500;
      const surcharge = 6_000; // 2% of £300k
      expect(result.baseTotal).toBe(baseDuty);
      expect(result.surcharge).toBe(surcharge);
      expect(result.total).toBe(baseDuty + surcharge);
      expect(result.surchargeRate).toBe(0.02);
    });
  });

  describe('Additional + Non-resident buyer', () => {
    it('should add 5% combined surcharge', () => {
      const result = calculateSDLT(300_000, 'additional_nonresident');
      const baseDuty = 2_500;
      const surcharge = 15_000; // 5% of £300k
      expect(result.baseTotal).toBe(baseDuty);
      expect(result.surcharge).toBe(surcharge);
      expect(result.total).toBe(baseDuty + surcharge);
      expect(result.surchargeRate).toBe(0.05);
    });
  });

  describe('Effective rate calculation', () => {
    it('should calculate correct effective rate', () => {
      const result = calculateSDLT(300_000, 'standard');
      const expectedRate = 2_500 / 300_000; // Total duty / Price
      expect(result.effectiveRate).toBeCloseTo(expectedRate, 5);
    });

    it('should handle 0 price without division error', () => {
      const result = calculateSDLT(0, 'standard');
      expect(result.effectiveRate).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle negative price as 0', () => {
      const result = calculateSDLT(-100_000, 'standard');
      expect(result.total).toBe(0);
      expect(result.baseTotal).toBe(0);
    });

    it('should handle very large prices', () => {
      const result = calculateSDLT(10_000_000, 'standard');
      expect(result.total).toBeGreaterThan(0);
      expect(result.effectiveRate).toBeGreaterThan(0);
      expect(result.effectiveRate).toBeLessThan(0.12); // Should be less than top rate
    });

    it('should round results to whole pounds', () => {
      const result = calculateSDLT(333_333, 'standard');
      expect(result.total).toBe(Math.round(result.total));
      expect(result.baseTotal).toBe(Math.round(result.baseTotal));
      expect(result.surcharge).toBe(Math.round(result.surcharge));
    });
  });
});

describe('formatGBP', () => {
  it('should format positive amounts correctly', () => {
    expect(formatGBP(1000)).toBe('£1,000');
    expect(formatGBP(1234567)).toBe('£1,234,567');
  });

  it('should format 0 correctly', () => {
    expect(formatGBP(0)).toBe('£0');
  });

  it('should format negative amounts correctly', () => {
    expect(formatGBP(-1000)).toBe('-£1,000');
  });

  it('should round to whole pounds', () => {
    expect(formatGBP(1234.56)).toBe('£1,235');
    expect(formatGBP(1234.44)).toBe('£1,234');
  });
});

describe('getBuyerTypeLabel', () => {
  it('should return correct labels for all buyer types', () => {
    expect(getBuyerTypeLabel('standard')).toBe('Standard residential');
    expect(getBuyerTypeLabel('additional')).toBe('Additional property (+3%)');
    expect(getBuyerTypeLabel('nonresident')).toBe('Non-resident (+2%)');
    expect(getBuyerTypeLabel('additional_nonresident')).toBe('Additional + Non-resident (+5%)');
  });

  it('should handle unknown buyer type', () => {
    expect(getBuyerTypeLabel('unknown' as BuyerType)).toBe('Unknown');
  });
});
