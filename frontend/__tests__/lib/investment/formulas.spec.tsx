// frontend/__tests__/lib/investment/formulas.test.ts
import {
  calculateBTL,
  calculateBRRR,
  calculateFlip,
  calculateSA,
  calculateHMO,
} from '@/lib/investment/formulas';
import type {
  BTLInput,
  BRRRInput,
  FlipInput,
  SAInput,
  HMOInput,
} from '@/lib/investment/types';

describe('Investment Formulas', () => {
  describe('calculateBTL', () => {
    it('should calculate BTL metrics correctly', () => {
      const input: BTLInput = {
        price: 200000,
        depositPercent: 25,
        interestRate: 4.5,
        termYears: 25,
        monthlyRent: 1200,
        monthlyCosts: 200,
      };

      const result = calculateBTL(input);

      expect(result.loanAmount).toBe(150000);
      expect(result.ltv).toBe(75);
      expect(result.monthlyPayment).toBeGreaterThan(0);
      expect(result.stressPayment).toBeGreaterThan(result.monthlyPayment);
      expect(result.netCashflow).toBeLessThan(result.monthlyPayment);
    });

    it('should handle zero price', () => {
      const input: BTLInput = {
        price: 0,
        depositPercent: 25,
        interestRate: 4.5,
        termYears: 25,
        monthlyRent: 1200,
        monthlyCosts: 200,
      };

      const result = calculateBTL(input);

      expect(result.loanAmount).toBe(0);
      expect(result.ltv).toBe(0);
      expect(result.monthlyPayment).toBe(0);
    });

    it('should handle zero deposit (100% LTV)', () => {
      const input: BTLInput = {
        price: 200000,
        depositPercent: 0,
        interestRate: 5.0,
        termYears: 25,
        monthlyRent: 1200,
        monthlyCosts: 200,
      };

      const result = calculateBTL(input);

      expect(result.loanAmount).toBe(200000);
      expect(result.ltv).toBe(100);
      expect(result.roi).toBe(0); // Infinite ROI handled as 0
    });

    it('should handle zero interest rate', () => {
      const input: BTLInput = {
        price: 200000,
        depositPercent: 25,
        interestRate: 0,
        termYears: 25,
        monthlyRent: 1200,
        monthlyCosts: 200,
      };

      const result = calculateBTL(input);

      expect(result.loanAmount).toBe(150000);
      expect(result.monthlyPayment).toBe(0);
      expect(result.netCashflow).toBe(1000);
    });

    it('should handle negative values gracefully', () => {
      const input: BTLInput = {
        price: -100000,
        depositPercent: 25,
        interestRate: 4.5,
        termYears: 25,
        monthlyRent: 1200,
        monthlyCosts: 200,
      };

      const result = calculateBTL(input);

      expect(result.loanAmount).toBe(0);
      expect(result.ltv).toBe(0);
    });
  });

  describe('calculateBRRR', () => {
    it('should calculate BRRR metrics correctly', () => {
      const input: BRRRInput = {
        purchasePrice: 150000,
        refurbCost: 30000,
        purchaseFees: 5000,
        arv: 220000,
        refiLtvPercent: 75,
        refiRate: 5.25,
        refiTermYears: 25,
        postRefurbRent: 1400,
        monthlyCosts: 200,
      };

      const result = calculateBRRR(input);

      expect(result.totalInvested).toBe(185000);
      expect(result.refiLoan).toBe(165000); // 75% of 220k
      expect(result.equityAfterRefi).toBe(55000);
      expect(result.cashLeftInDeal).toBe(20000);
      expect(result.postRefurbCashflow).toBeLessThan(1400);
    });

    it('should handle zero refurb cost', () => {
      const input: BRRRInput = {
        purchasePrice: 150000,
        refurbCost: 0,
        purchaseFees: 0,
        arv: 150000,
        refiLtvPercent: 75,
        refiRate: 5.0,
        refiTermYears: 25,
        postRefurbRent: 1200,
        monthlyCosts: 200,
      };

      const result = calculateBRRR(input);

      expect(result.totalInvested).toBe(150000);
      expect(result.refiLoan).toBe(112500);
    });

    it('should handle 100% cash-out refinance', () => {
      const input: BRRRInput = {
        purchasePrice: 100000,
        refurbCost: 20000,
        purchaseFees: 5000,
        arv: 180000,
        refiLtvPercent: 75,
        refiRate: 5.5,
        refiTermYears: 25,
        postRefurbRent: 1300,
        monthlyCosts: 200,
      };

      const result = calculateBRRR(input);

      expect(result.totalInvested).toBe(125000);
      expect(result.refiLoan).toBe(135000); // 75% of ARV
      expect(result.cashLeftInDeal).toBe(0); // Full cash out
    });

    it('should handle negative values', () => {
      const input: BRRRInput = {
        purchasePrice: -100000,
        refurbCost: 20000,
        purchaseFees: 5000,
        arv: 180000,
        refiLtvPercent: 75,
        refiRate: 5.5,
        refiTermYears: 25,
        postRefurbRent: 1300,
        monthlyCosts: 200,
      };

      const result = calculateBRRR(input);

      expect(result.totalInvested).toBe(0);
      expect(result.equityAfterRefi).toBe(0);
    });
  });

  describe('calculateFlip', () => {
    it('should calculate Flip metrics correctly', () => {
      const input: FlipInput = {
        purchasePrice: 180000,
        refurbCost: 40000,
        purchaseFees: 5000,
        holdingMonths: 6,
        holdingRate: 5.0,
        targetSalePrice: 280000,
        sellingFees: 8000,
      };

      const result = calculateFlip(input);

      expect(result.totalCost).toBeGreaterThan(225000);
      expect(result.grossProfit).toBeGreaterThan(0);
      expect(result.profitOnCost).toBeGreaterThan(0);
      expect(result.annualizedROI).toBeGreaterThan(result.profitOnCost);
    });

    it('should handle zero holding cost', () => {
      const input: FlipInput = {
        purchasePrice: 180000,
        refurbCost: 40000,
        purchaseFees: 5000,
        holdingMonths: 0,
        holdingRate: 0,
        targetSalePrice: 280000,
        sellingFees: 8000,
      };

      const result = calculateFlip(input);

      expect(result.totalCost).toBe(233000);
      expect(result.grossProfit).toBe(47000);
    });

    it('should handle loss scenario', () => {
      const input: FlipInput = {
        purchasePrice: 180000,
        refurbCost: 60000,
        purchaseFees: 10000,
        holdingMonths: 12,
        holdingRate: 6.0,
        targetSalePrice: 220000,
        sellingFees: 10000,
      };

      const result = calculateFlip(input);

      expect(result.grossProfit).toBeLessThan(0); // Loss
      expect(result.profitOnCost).toBeLessThan(0);
    });

    it('should handle negative price', () => {
      const input: FlipInput = {
        purchasePrice: -100000,
        refurbCost: 40000,
        purchaseFees: 5000,
        holdingMonths: 6,
        holdingRate: 5.0,
        targetSalePrice: 280000,
        sellingFees: 8000,
      };

      const result = calculateFlip(input);

      expect(result.totalCost).toBe(0);
      expect(result.grossProfit).toBe(0);
    });
  });

  describe('calculateSA', () => {
    it('should calculate SA metrics correctly', () => {
      const input: SAInput = {
        adr: 120,
        occupancyPercent: 75,
        nightsPerMonth: 30,
        cleaningFees: 300,
        channelFees: 200,
        monthlyMortgage: 800,
        otherMonthlyCosts: 100,
      };

      const result = calculateSA(input);

      expect(result.grossMonthlyRevenue).toBe(2700); // 120 * 22.5
      expect(result.netMonthlyRevenue).toBe(2200); // 2700 - 300 - 200
      expect(result.netCashflow).toBe(1300); // 2200 - 800 - 100
      expect(result.annualNOI).toBe(15600);
    });

    it('should handle zero occupancy', () => {
      const input: SAInput = {
        adr: 120,
        occupancyPercent: 0,
        nightsPerMonth: 30,
        cleaningFees: 300,
        channelFees: 200,
        monthlyMortgage: 800,
        otherMonthlyCosts: 100,
      };

      const result = calculateSA(input);

      expect(result.grossMonthlyRevenue).toBe(0);
      expect(result.netCashflow).toBeLessThan(0); // Losing money
    });

    it('should handle 100% occupancy', () => {
      const input: SAInput = {
        adr: 100,
        occupancyPercent: 100,
        nightsPerMonth: 30,
        cleaningFees: 400,
        channelFees: 300,
        monthlyMortgage: 600,
        otherMonthlyCosts: 200,
      };

      const result = calculateSA(input);

      expect(result.grossMonthlyRevenue).toBe(3000);
      expect(result.netMonthlyRevenue).toBe(2300);
      expect(result.netCashflow).toBe(1500);
    });

    it('should handle negative ADR', () => {
      const input: SAInput = {
        adr: -120,
        occupancyPercent: 75,
        nightsPerMonth: 30,
        cleaningFees: 300,
        channelFees: 200,
        monthlyMortgage: 800,
        otherMonthlyCosts: 100,
      };

      const result = calculateSA(input);

      expect(result.grossMonthlyRevenue).toBe(0);
      expect(result.netCashflow).toBe(0);
    });
  });

  describe('calculateHMO', () => {
    it('should calculate HMO metrics correctly', () => {
      const input: HMOInput = {
        rooms: 5,
        rentPerRoom: 500,
        voidPercent: 10,
        monthlyBills: 300,
        monthlyMortgage: 800,
        otherMonthlyCosts: 150,
        totalInvestment: 50000,
      };

      const result = calculateHMO(input);

      expect(result.grossMonthlyRent).toBe(2500);
      expect(result.effectiveRent).toBe(2250); // 10% void
      expect(result.netCashflow).toBe(1000); // 2250 - 300 - 800 - 150
      expect(result.annualYield).toBe(12000);
      expect(result.roi).toBe(24); // 12000 / 50000 * 100
    });

    it('should handle zero rooms', () => {
      const input: HMOInput = {
        rooms: 0,
        rentPerRoom: 500,
        voidPercent: 10,
        monthlyBills: 300,
        monthlyMortgage: 800,
        otherMonthlyCosts: 150,
        totalInvestment: 50000,
      };

      const result = calculateHMO(input);

      expect(result.grossMonthlyRent).toBe(0);
      expect(result.netCashflow).toBeLessThan(0);
    });

    it('should handle zero void', () => {
      const input: HMOInput = {
        rooms: 4,
        rentPerRoom: 600,
        voidPercent: 0,
        monthlyBills: 200,
        monthlyMortgage: 1000,
        otherMonthlyCosts: 100,
        totalInvestment: 60000,
      };

      const result = calculateHMO(input);

      expect(result.grossMonthlyRent).toBe(2400);
      expect(result.effectiveRent).toBe(2400);
      expect(result.netCashflow).toBe(1100);
    });

    it('should handle 100% void', () => {
      const input: HMOInput = {
        rooms: 5,
        rentPerRoom: 500,
        voidPercent: 100,
        monthlyBills: 300,
        monthlyMortgage: 800,
        otherMonthlyCosts: 150,
        totalInvestment: 50000,
      };

      const result = calculateHMO(input);

      expect(result.effectiveRent).toBe(0);
      expect(result.netCashflow).toBeLessThan(0);
    });

    it('should handle undefined totalInvestment', () => {
      const input: HMOInput = {
        rooms: 5,
        rentPerRoom: 500,
        voidPercent: 10,
        monthlyBills: 300,
        monthlyMortgage: 800,
        otherMonthlyCosts: 150,
      };

      const result = calculateHMO(input);

      expect(result.roi).toBe(0);
    });

    it('should handle negative values', () => {
      const input: HMOInput = {
        rooms: -5,
        rentPerRoom: 500,
        voidPercent: 10,
        monthlyBills: 300,
        monthlyMortgage: 800,
        otherMonthlyCosts: 150,
        totalInvestment: 50000,
      };

      const result = calculateHMO(input);

      expect(result.grossMonthlyRent).toBe(0);
    });
  });
});
