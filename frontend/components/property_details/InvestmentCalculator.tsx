// frontend/components/property_details/InvestmentCalculator.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiChevronDown, FiChevronUp, FiInfo } from 'react-icons/fi';
import BTLCalculator from './calculators/BTLCalculator';
import BRRRCalculator from './calculators/BRRRCalculator';
import FlipCalculator from './calculators/FlipCalculator';
import SACalculator from './calculators/SACalculator';
import HMOCalculator from './calculators/HMOCalculator';
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
  const [showTooltip, setShowTooltip] = useState(false);

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
    <div className="border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden transition-all duration-300">
      {/* Collapsed Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 md:p-6 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        aria-expanded={isExpanded}
        aria-controls="calculator-content"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Investment Calculator
          </h3>
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
              aria-label="Calculator help"
              type="button"
              onClick={(e) => e.stopPropagation()}
            >
              <FiInfo className="w-4 h-4" />
            </button>
            {showTooltip && (
              <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg shadow-lg z-10">
                Calculate returns for different investment strategies. Your inputs are saved
                automatically.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!isExpanded && (
            <div className="hidden md:flex gap-2">
              {(['BTL', 'BRRR', 'Flip', 'SA', 'HMO'] as InvestmentStrategy[]).map((s) => (
                <button
                  key={s}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStrategyChange(s);
                  }}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                    strategy === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {isExpanded ? (
            <FiChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          ) : (
            <FiChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div
          id="calculator-content"
          className="border-t border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 md:p-6 space-y-6"
        >
          {/* Strategy Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Strategy
            </label>
            <div className="flex flex-wrap gap-2">
              {(['BTL', 'BRRR', 'Flip', 'SA', 'HMO'] as InvestmentStrategy[]).map((s) => (
                <button
                  key={s}
                  onClick={() => handleStrategyChange(s)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    strategy === s
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {STRATEGY_LABELS[s]}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {STRATEGY_DESCRIPTIONS[strategy]}
            </p>
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
        </div>
      )}
    </div>
  );
}
