// frontend/lib/investment/types.ts
import { z } from 'zod';

// Strategy types
export type InvestmentStrategy = 'BTL' | 'BRRR' | 'Flip' | 'SA' | 'HMO';

// Common input schema (non-negative numbers, allow 0)
const nonNegative = z.number().min(0);
const percentage = z.number().min(0).max(100);

// BTL (Buy-to-Let) inputs
export const BTLInputSchema = z.object({
  price: nonNegative,
  depositPercent: percentage,
  interestRate: nonNegative,
  termYears: nonNegative,
  monthlyRent: nonNegative,
  monthlyCosts: nonNegative.default(0),
});

export type BTLInput = z.infer<typeof BTLInputSchema>;

export interface BTLOutput {
  loanAmount: number;
  ltv: number;
  monthlyPayment: number;
  stressPayment: number;
  netCashflow: number;
  annualYield: number;
  roi: number;
}

// BRRR (Buy, Refurb, Rent, Refinance) inputs
export const BRRRInputSchema = z.object({
  purchasePrice: nonNegative,
  refurbCost: nonNegative,
  purchaseFees: nonNegative.default(0),
  arv: nonNegative, // After Repair Value
  refiLtvPercent: percentage,
  refiRate: nonNegative,
  refiTermYears: nonNegative.default(25),
  postRefurbRent: nonNegative,
  monthlyCosts: nonNegative.default(0),
});

export type BRRRInput = z.infer<typeof BRRRInputSchema>;

export interface BRRROutput {
  totalInvested: number;
  equityAfterRefi: number;
  refiLoan: number;
  refiPayment: number;
  cashLeftInDeal: number;
  postRefurbCashflow: number;
  roi: number;
}

// Flip inputs
export const FlipInputSchema = z.object({
  purchasePrice: nonNegative,
  refurbCost: nonNegative,
  purchaseFees: nonNegative.default(0),
  holdingMonths: nonNegative.default(6),
  holdingRate: nonNegative.default(0),
  targetSalePrice: nonNegative,
  sellingFees: nonNegative.default(0),
});

export type FlipInput = z.infer<typeof FlipInputSchema>;

export interface FlipOutput {
  totalCost: number;
  grossProfit: number;
  netProfit: number;
  profitOnCost: number;
  annualizedROI: number;
}

// SA (Serviced Accommodation) inputs
export const SAInputSchema = z.object({
  adr: nonNegative, // Average Daily Rate
  occupancyPercent: percentage,
  nightsPerMonth: nonNegative.default(30),
  cleaningFees: nonNegative.default(0),
  channelFees: nonNegative.default(0),
  monthlyMortgage: nonNegative.default(0),
  otherMonthlyCosts: nonNegative.default(0),
});

export type SAInput = z.infer<typeof SAInputSchema>;

export interface SAOutput {
  grossMonthlyRevenue: number;
  netMonthlyRevenue: number;
  netCashflow: number;
  annualNOI: number;
  annualYield: number;
}

// HMO (House in Multiple Occupation) inputs
export const HMOInputSchema = z.object({
  rooms: z.number().int().min(0),
  rentPerRoom: nonNegative,
  voidPercent: percentage.default(10),
  monthlyBills: nonNegative.default(0),
  monthlyMortgage: nonNegative.default(0),
  otherMonthlyCosts: nonNegative.default(0),
  totalInvestment: nonNegative.optional(),
});

export type HMOInput = z.infer<typeof HMOInputSchema>;

export interface HMOOutput {
  grossMonthlyRent: number;
  effectiveRent: number;
  netCashflow: number;
  annualYield: number;
  roi: number;
}

// Union type for all calculator states
export type CalculatorInput = BTLInput | BRRRInput | FlipInput | SAInput | HMOInput;
export type CalculatorOutput = BTLOutput | BRRROutput | FlipOutput | SAOutput | HMOOutput;

// Persistence structure
export interface CalculatorState {
  strategy: InvestmentStrategy;
  inputs: any;
  lastUpdated: string;
}
