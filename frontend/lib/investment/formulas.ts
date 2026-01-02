// frontend/lib/investment/formulas.ts
// Pure calculation functions for investment strategies
// All functions handle edge cases: zero, negative, undefined gracefully

import type {
  BTLInput,
  BTLOutput,
  BRRRInput,
  BRRROutput,
  FlipInput,
  FlipOutput,
  SAInput,
  SAOutput,
  HMOInput,
  HMOOutput,
} from './types';

const STRESS_RATE = 6.0; // Stress test at 6%

/**
 * Calculate BTL (Buy-to-Let) metrics
 */
export function calculateBTL(input: BTLInput): BTLOutput {
  const { price, depositPercent, interestRate, termYears, monthlyRent, monthlyCosts } = input;

  // Handle edge cases
  if (price <= 0 || depositPercent < 0 || depositPercent > 100) {
    return {
      loanAmount: 0,
      ltv: 0,
      monthlyPayment: 0,
      stressPayment: 0,
      netCashflow: 0,
      annualYield: 0,
      roi: 0,
    };
  }

  const deposit = (price * depositPercent) / 100;
  const loanAmount = Math.max(0, price - deposit);
  const ltv = price > 0 ? (loanAmount / price) * 100 : 0;

  // Monthly payment calculation (interest-only for BTL typically)
  const monthlyRate = interestRate / 100 / 12;
  const months = termYears * 12;

  let monthlyPayment = 0;
  if (loanAmount > 0 && months > 0 && monthlyRate > 0) {
    // Repayment mortgage formula
    monthlyPayment = (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  }

  // Stress test at 6%
  const stressRate = STRESS_RATE / 100 / 12;
  let stressPayment = 0;
  if (loanAmount > 0 && months > 0 && stressRate > 0) {
    stressPayment = (loanAmount * stressRate) / (1 - Math.pow(1 + stressRate, -months));
  }

  const netCashflow = monthlyRent - monthlyPayment - (monthlyCosts ?? 0);
  const annualCashflow = netCashflow * 12;
  const annualYield = price > 0 ? (annualCashflow / price) * 100 : 0;
  const roi = deposit > 0 ? (annualCashflow / deposit) * 100 : 0;

  return {
    loanAmount,
    ltv,
    monthlyPayment,
    stressPayment,
    netCashflow,
    annualYield,
    roi,
  };
}

/**
 * Calculate BRRR (Buy, Refurb, Rent, Refinance) metrics
 */
export function calculateBRRR(input: BRRRInput): BRRROutput {
  const {
    purchasePrice,
    refurbCost,
    purchaseFees,
    arv,
    refiLtvPercent,
    refiRate,
    refiTermYears,
    postRefurbRent,
    monthlyCosts,
  } = input;

  // Handle edge cases
  if (purchasePrice < 0 || refurbCost < 0 || arv < 0) {
    return {
      totalInvested: 0,
      equityAfterRefi: 0,
      refiLoan: 0,
      refiPayment: 0,
      cashLeftInDeal: 0,
      postRefurbCashflow: 0,
      roi: 0,
    };
  }

  const totalInvested = purchasePrice + refurbCost + (purchaseFees ?? 0);
  const refiLoan = (arv * refiLtvPercent) / 100;
  const equityAfterRefi = Math.max(0, arv - refiLoan);

  // Monthly refinance payment
  const refiMonthlyRate = refiRate / 100 / 12;
  const refiMonths = refiTermYears * 12;

  let refiPayment = 0;
  if (refiLoan > 0 && refiMonths > 0 && refiMonthlyRate > 0) {
    refiPayment = (refiLoan * refiMonthlyRate) / (1 - Math.pow(1 + refiMonthlyRate, -refiMonths));
  }

  const cashLeftInDeal = Math.max(0, totalInvested - refiLoan);
  const postRefurbCashflow = postRefurbRent - refiPayment - (monthlyCosts ?? 0);
  const annualCashflow = postRefurbCashflow * 12;
  const roi = cashLeftInDeal > 0 ? (annualCashflow / cashLeftInDeal) * 100 : 0;

  return {
    totalInvested,
    equityAfterRefi,
    refiLoan,
    refiPayment,
    cashLeftInDeal,
    postRefurbCashflow,
    roi,
  };
}

/**
 * Calculate Flip metrics
 */
export function calculateFlip(input: FlipInput): FlipOutput {
  const {
    purchasePrice,
    refurbCost,
    purchaseFees,
    holdingMonths,
    holdingRate,
    targetSalePrice,
    sellingFees,
  } = input;

  // Handle edge cases
  if (purchasePrice < 0 || refurbCost < 0 || targetSalePrice < 0) {
    return {
      totalCost: 0,
      grossProfit: 0,
      netProfit: 0,
      profitOnCost: 0,
      annualizedROI: 0,
    };
  }

  const holdingCost =
    purchasePrice * (holdingRate / 100) * ((holdingMonths ?? 0) / 12);
  const totalCost =
    purchasePrice + refurbCost + (purchaseFees ?? 0) + holdingCost + (sellingFees ?? 0);
  const grossProfit = targetSalePrice - totalCost;
  const netProfit = grossProfit; // Same as gross in this simplified model
  const profitOnCost = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

  // Annualized ROI
  const years = holdingMonths > 0 ? holdingMonths / 12 : 1;
  const annualizedROI = years > 0 ? profitOnCost / years : 0;

  return {
    totalCost,
    grossProfit,
    netProfit,
    profitOnCost,
    annualizedROI,
  };
}

/**
 * Calculate SA (Serviced Accommodation) metrics
 */
export function calculateSA(input: SAInput): SAOutput {
  const {
    adr,
    occupancyPercent,
    nightsPerMonth,
    cleaningFees,
    channelFees,
    monthlyMortgage,
    otherMonthlyCosts,
  } = input;

  // Handle edge cases
  if (adr < 0 || occupancyPercent < 0 || occupancyPercent > 100) {
    return {
      grossMonthlyRevenue: 0,
      netMonthlyRevenue: 0,
      netCashflow: 0,
      annualNOI: 0,
      annualYield: 0,
    };
  }

  const occupiedNights = ((nightsPerMonth ?? 30) * occupancyPercent) / 100;
  const grossMonthlyRevenue = adr * occupiedNights;
  const netMonthlyRevenue =
    grossMonthlyRevenue - (cleaningFees ?? 0) - (channelFees ?? 0);
  const netCashflow =
    netMonthlyRevenue - (monthlyMortgage ?? 0) - (otherMonthlyCosts ?? 0);
  const annualNOI = netCashflow * 12;
  const annualYield = annualNOI; // Simplified; would need property value for true yield

  return {
    grossMonthlyRevenue,
    netMonthlyRevenue,
    netCashflow,
    annualNOI,
    annualYield,
  };
}

/**
 * Calculate HMO (House in Multiple Occupation) metrics
 */
export function calculateHMO(input: HMOInput): HMOOutput {
  const {
    rooms,
    rentPerRoom,
    voidPercent,
    monthlyBills,
    monthlyMortgage,
    otherMonthlyCosts,
    totalInvestment,
  } = input;

  // Handle edge cases
  if (rooms < 0 || rentPerRoom < 0 || voidPercent < 0 || voidPercent > 100) {
    return {
      grossMonthlyRent: 0,
      effectiveRent: 0,
      netCashflow: 0,
      annualYield: 0,
      roi: 0,
    };
  }

  const grossMonthlyRent = rooms * rentPerRoom;
  const voidLoss = (grossMonthlyRent * (voidPercent ?? 0)) / 100;
  const effectiveRent = grossMonthlyRent - voidLoss;
  const netCashflow =
    effectiveRent -
    (monthlyBills ?? 0) -
    (monthlyMortgage ?? 0) -
    (otherMonthlyCosts ?? 0);
  const annualCashflow = netCashflow * 12;
  const annualYield = annualCashflow; // Simplified
  const roi = totalInvestment && totalInvestment > 0
    ? (annualCashflow / totalInvestment) * 100
    : 0;

  return {
    grossMonthlyRent,
    effectiveRent,
    netCashflow,
    annualYield,
    roi,
  };
}
