export interface MortgagePaymentInput {
  principal: number;
  annualRatePct: number;
  termYears: number;
  interestOnly?: boolean;
}

export interface MortgageProjectionInput {
  principal: number;
  annualRatePct: number;
  termYears: number;
  monthlyOverpayment?: number;
}

export interface AmortizationYearPoint {
  year: number;
  balance: number;
}

export interface MortgageProjection {
  baseMonthlyPayment: number;
  actualMonthlyPayment: number;
  monthsToPayoff: number;
  totalPaid: number;
  totalInterest: number;
  yearlyBalance: AmortizationYearPoint[];
}

function toNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function calculateMonthlyMortgagePayment(input: MortgagePaymentInput): number {
  const principal = toNonNegative(input.principal);
  const annualRatePct = toNonNegative(input.annualRatePct);
  const termYears = toNonNegative(input.termYears);
  const interestOnly = Boolean(input.interestOnly);

  if (principal <= 0) return 0;

  const months = Math.round(termYears * 12);
  if (months <= 0) return 0;

  const monthlyRate = annualRatePct / 100 / 12;

  if (interestOnly) {
    return principal * monthlyRate;
  }

  if (monthlyRate <= 0) {
    return principal / months;
  }

  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

export function calculateLoanToValue(price: number, loanAmount: number): number {
  const safePrice = toNonNegative(price);
  const safeLoan = toNonNegative(loanAmount);
  if (safePrice <= 0) return 0;
  return (safeLoan / safePrice) * 100;
}

export function clampPercent(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function projectMortgage(input: MortgageProjectionInput): MortgageProjection {
  const principal = toNonNegative(input.principal);
  const annualRatePct = toNonNegative(input.annualRatePct);
  const termYears = toNonNegative(input.termYears);
  const monthlyOverpayment = toNonNegative(input.monthlyOverpayment ?? 0);

  const baseMonthlyPayment = calculateMonthlyMortgagePayment({
    principal,
    annualRatePct,
    termYears,
    interestOnly: false,
  });

  const months = Math.round(termYears * 12);
  if (principal <= 0 || months <= 0) {
    return {
      baseMonthlyPayment,
      actualMonthlyPayment: baseMonthlyPayment,
      monthsToPayoff: 0,
      totalPaid: 0,
      totalInterest: 0,
      yearlyBalance: [],
    };
  }

  const monthlyRate = annualRatePct / 100 / 12;
  const actualMonthlyPayment = baseMonthlyPayment + monthlyOverpayment;

  if (monthlyRate <= 0) {
    const linearMonths = Math.ceil(principal / Math.max(actualMonthlyPayment, 1));
    const totalPaid = principal;
    return {
      baseMonthlyPayment,
      actualMonthlyPayment,
      monthsToPayoff: linearMonths,
      totalPaid,
      totalInterest: 0,
      yearlyBalance: buildLinearYearlyBalance(principal, actualMonthlyPayment, linearMonths),
    };
  }

  if (actualMonthlyPayment <= principal * monthlyRate) {
    return {
      baseMonthlyPayment,
      actualMonthlyPayment,
      monthsToPayoff: months,
      totalPaid: baseMonthlyPayment * months,
      totalInterest: Math.max(baseMonthlyPayment * months - principal, 0),
      yearlyBalance: buildScheduledYearlyBalance(principal, monthlyRate, baseMonthlyPayment, months),
    };
  }

  let remaining = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;
  const yearlyBalance: AmortizationYearPoint[] = [{ year: 0, balance: principal }];

  while (remaining > 0.01 && month < 1200) {
    const interest = remaining * monthlyRate;
    const principalPaid = Math.max(actualMonthlyPayment - interest, 0);
    const installment = Math.min(actualMonthlyPayment, remaining + interest);

    remaining = Math.max(remaining - principalPaid, 0);
    totalInterest += interest;
    totalPaid += installment;
    month += 1;

    if (month % 12 === 0 || remaining <= 0.01) {
      yearlyBalance.push({ year: Math.ceil(month / 12), balance: remaining });
    }
  }

  return {
    baseMonthlyPayment,
    actualMonthlyPayment,
    monthsToPayoff: month,
    totalPaid,
    totalInterest,
    yearlyBalance,
  };
}

function buildLinearYearlyBalance(
  principal: number,
  monthlyPayment: number,
  monthsToPayoff: number,
): AmortizationYearPoint[] {
  const points: AmortizationYearPoint[] = [{ year: 0, balance: principal }];
  for (let month = 12; month <= monthsToPayoff; month += 12) {
    const balance = Math.max(principal - month * monthlyPayment, 0);
    points.push({ year: Math.ceil(month / 12), balance });
  }
  if (monthsToPayoff % 12 !== 0) {
    points.push({ year: Math.ceil(monthsToPayoff / 12), balance: 0 });
  }
  return points;
}

function buildScheduledYearlyBalance(
  principal: number,
  monthlyRate: number,
  monthlyPayment: number,
  months: number,
): AmortizationYearPoint[] {
  const points: AmortizationYearPoint[] = [{ year: 0, balance: principal }];
  let remaining = principal;
  for (let month = 1; month <= months; month += 1) {
    const interest = remaining * monthlyRate;
    const principalPaid = Math.max(monthlyPayment - interest, 0);
    remaining = Math.max(remaining - principalPaid, 0);
    if (month % 12 === 0 || month === months) {
      points.push({ year: Math.ceil(month / 12), balance: remaining });
    }
  }
  return points;
}
