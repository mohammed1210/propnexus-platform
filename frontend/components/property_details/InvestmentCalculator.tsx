// frontend/components/property_details/InvestmentCalculator.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiBarChart2,
  FiChevronDown,
  FiDollarSign,
} from 'react-icons/fi';
import BTLCalculator from './calculators/BTLCalculator';
import BRRRCalculator from './calculators/BRRRCalculator';
import FlipCalculator from './calculators/FlipCalculator';
import SACalculator from './calculators/SACalculator';
import HMOCalculator from './calculators/HMOCalculator';
import StampDutyCalculator from './StampDutyCalculator';
import type { InvestmentStrategy, CalculatorState, CalculatorInput } from '@/lib/investment/types';

interface InvestmentCalculatorProps {
  propertyId: string;
  initialPrice?: number;
}

const STRATEGY_LABELS: Record<InvestmentStrategy, string> = {
  BTL: 'Buy-to-Let',
  BRRR: 'BRRR',
  Flip: 'Flip',
  SA: 'Serviced Accommodation',
  HMO: 'HMO',
};

const STRATEGY_DESCRIPTIONS: Record<InvestmentStrategy, string> = {
  BTL: 'Traditional rental property with long-term tenants',
  BRRR: 'Buy, Refurb, Rent, Refinance - recycle your capital',
  Flip: 'Buy, renovate, and sell for profit',
  SA: 'Short-term rentals via Airbnb, Booking.com',
  HMO: 'House in Multiple Occupation - rent by room',
};

export default function InvestmentCalculator({
  propertyId,
  initialPrice,
}: InvestmentCalculatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [strategy, setStrategy] = useState<InvestmentStrategy>('BTL');
  const [calculatorInputs, setCalculatorInputs] = useState<any>({});

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const key = `calc-${propertyId}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const state: CalculatorState = JSON.parse(saved);
        setStrategy(state.strategy);
        setCalculatorInputs(state.inputs);
      }
    } catch (err) {
      console.error('Failed to load calculator state:', err);
    }
  }, [propertyId]);

  // Save to localStorage on changes
  const saveState = useCallback(() => {
    if (typeof window === 'undefined') return;

    const key = `calc-${propertyId}`;
    const state: CalculatorState = {
      strategy,
      inputs: calculatorInputs,
      lastUpdated: new Date().toISOString(),
    };

    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to save calculator state:', err);
    }
  }, [propertyId, strategy, calculatorInputs]);

  useEffect(() => {
    saveState();
  }, [saveState]);

  const handleStrategyChange = (newStrategy: InvestmentStrategy) => {
    setStrategy(newStrategy);
    // Preserve saved inputs for the new strategy
    const key = `calc-${propertyId}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const state: CalculatorState = JSON.parse(saved);
        if (state.strategy === newStrategy) {
          setCalculatorInputs(state.inputs);
        } else {
          setCalculatorInputs({});
        }
      } else {
        setCalculatorInputs({});
      }
    } catch {
      setCalculatorInputs({});
    }
  };

  const handleInputChange = (inputs: any) => {
    setCalculatorInputs(inputs);
  };

  return (
    <div className="rounded-[1.35rem] border border-brand-200/70 bg-white shadow-sm transition-all duration-300 dark:border-brand-900/60 dark:bg-slate-950">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={
          'relative w-full overflow-hidden rounded-t-[1.35rem] bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-4 py-3 text-left text-white md:px-5 md:py-3.5 ' +
          'transition-all hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 dark:from-brand-950 dark:via-brand-900 dark:to-brand-800'
        }
        aria-expanded={isExpanded}
        aria-controls="calculator-content"
      >
        <span className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-white/15 blur-3xl" aria-hidden="true" />
        <span className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-emerald-300/15 blur-3xl" aria-hidden="true" />

        <span className="relative flex w-full items-center gap-3">
          <span className="shrink-0 rounded-xl border border-white/10 bg-white/10 p-0.5 shadow-sm backdrop-blur">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600">
              <FiDollarSign className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-black leading-tight tracking-tight text-white sm:text-xl">
              Investment Calculator
            </span>
            <span className="mt-0.5 block text-xs font-medium leading-4 text-white/80">
              Model finance, returns and acquisition costs in one investor-ready workspace.
            </span>
          </span>

          <span
            className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white shadow-sm backdrop-blur transition-transform"
            aria-hidden="true"
          >
            <FiChevronDown
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
            />
          </span>
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div
          id="calculator-content"
          className="border-t border-brand-100 bg-slate-50/70 p-4 dark:border-brand-900/50 dark:bg-slate-950/95 md:p-5"
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 md:p-5">
              {/* Strategy Selector */}
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">
                    <FiBarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Strategy model
                  </div>
                  <h4 className="mt-3 text-xl font-black tracking-tight text-slate-950 dark:text-white">
                    {STRATEGY_LABELS[strategy]}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {STRATEGY_DESCRIPTIONS[strategy]}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['BTL', 'BRRR', 'Flip', 'SA', 'HMO'] as InvestmentStrategy[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStrategyChange(s)}
                      className={`rounded-full px-4 py-2 text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                        strategy === s
                          ? 'bg-brand-600 text-white shadow-md shadow-brand-900/10'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                      type="button"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculator Content */}
              <div>
                {strategy === 'BTL' && (
                  <BTLCalculator
                    initialPrice={initialPrice}
                    savedInputs={calculatorInputs}
                    onInputChange={handleInputChange}
                  />
                )}
                {strategy === 'BRRR' && (
                  <BRRRCalculator
                    initialPrice={initialPrice}
                    savedInputs={calculatorInputs}
                    onInputChange={handleInputChange}
                  />
                )}
                {strategy === 'Flip' && (
                  <FlipCalculator
                    initialPrice={initialPrice}
                    savedInputs={calculatorInputs}
                    onInputChange={handleInputChange}
                  />
                )}
                {strategy === 'SA' && (
                  <SACalculator savedInputs={calculatorInputs} onInputChange={handleInputChange} />
                )}
                {strategy === 'HMO' && (
                  <HMOCalculator savedInputs={calculatorInputs} onInputChange={handleInputChange} />
                )}
              </div>
            </section>

            <StampDutyCalculator price={initialPrice ?? 0} className="h-full" />
          </div>
        </div>
      )}
    </div>
  );
}
