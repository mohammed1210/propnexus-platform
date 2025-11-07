// frontend/components/property_details/DealScore.tsx
'use client';

import { useEffect, useState } from 'react';
import { postAIScore, postAIScoreExplain } from '@/lib/api';
import { FF } from '@/lib/flags';

interface PropertyData {
  id?: string;
  price?: number;
  location?: string;
  bedrooms?: number;
  yield_percent?: number;
  roi_percent?: number;
  rent?: number;
  avg_rent?: number;
  crime_index?: number;
  schools_rating?: number;
  [key: string]: any;
}

interface DealScoreProps {
  property: PropertyData;
}

interface ScoreData {
  score: number;
  categories: {
    yield: number;
    roi: number;
    price_to_rent: number;
    area_demand: number;
    crime_index_inverse: number;
    schools_access: number;
  };
}

interface ExplanationData {
  explanation: string;
  bullets: string[];
}

export default function DealScore({ property }: DealScoreProps) {
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [explanation, setExplanation] = useState<ExplanationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExplanation, setShowExplanation] = useState(false);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  useEffect(() => {
    if (!property) return;

    const fetchScore = async () => {
      setLoading(true);
      try {
        const response = await postAIScore(property);
        if (response && typeof response.score === 'number') {
          setScoreData({
            score: response.score,
            categories: response.categories,
          });
        }
      } catch (err) {
        console.error('Error fetching deal score:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchScore();
  }, [property]);

  const handleExplainScore = async () => {
    if (explanation) {
      // Toggle visibility if already loaded
      setShowExplanation(!showExplanation);
      return;
    }

    setLoadingExplanation(true);
    setShowExplanation(true);
    try {
      const response = await postAIScoreExplain({
        score: scoreData?.score || 0,
        property,
      });
      if (response && response.explanation) {
        setExplanation({
          explanation: response.explanation,
          bullets: response.bullets || [],
        });
      }
    } catch (err) {
      console.error('Error fetching score explanation:', err);
      setExplanation({
        explanation: 'Unable to generate explanation at this time.',
        bullets: [],
      });
    } finally {
      setLoadingExplanation(false);
    }
  };

  // Feature flag guard - return null if feature is disabled
  if (!FF.DEAL_SCORE) {
    return null;
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-24 bg-gray-200 dark:bg-neutral-800 rounded mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (!scoreData) {
    return (
      <div className="text-gray-600 dark:text-neutral-400">
        <p>Score unavailable</p>
      </div>
    );
  }

  const { score, categories } = scoreData;

  // Determine score color
  const getScoreColor = (s: number) => {
    if (s >= 75) return 'text-green-600 dark:text-green-400';
    if (s >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const maxPoints = {
    yield: 20,
    roi: 20,
    price_to_rent: 15,
    area_demand: 15,
    crime_index_inverse: 15,
    schools_access: 15,
  };

  const categoryLabels: Record<string, string> = {
    yield: 'Rental Yield',
    roi: 'ROI Potential',
    price_to_rent: 'Price-to-Rent',
    area_demand: 'Area Demand',
    crime_index_inverse: 'Safety Index',
    schools_access: 'Schools Access',
  };

  return (
    <div>
      {/* Score badge */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className={`text-6xl font-bold ${getScoreColor(score)}`}>{Math.round(score)}</div>
          <div className="text-gray-600 dark:text-neutral-400">
            <div className="text-sm font-medium">AI Deal Score</div>
            <div className="text-xs">Out of 100</div>
          </div>
        </div>
        <button
          onClick={handleExplainScore}
          className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-neutral-800 rounded-md transition"
        >
          {loadingExplanation ? 'Loading...' : explanation ? (showExplanation ? 'Hide' : 'Show') + ' Details' : 'Why this score?'}
        </button>
      </div>

      {/* Category breakdown */}
      <div className="space-y-3 mb-4">
        {Object.entries(categories).map(([key, value]) => {
          const max = maxPoints[key as keyof typeof maxPoints];
          const percentage = (value / max) * 100;
          return (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700 dark:text-neutral-300">
                  {categoryLabels[key]}
                </span>
                <span className="text-gray-600 dark:text-neutral-400">
                  {value.toFixed(1)}/{max}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explanation section */}
      {showExplanation && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-neutral-700">
          <h3 className="font-semibold text-lg mb-3">Score Analysis</h3>
          {loadingExplanation ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-4/6"></div>
            </div>
          ) : explanation ? (
            <>
              {explanation.explanation && (
                <p className="text-gray-700 dark:text-neutral-300 mb-4">
                  {explanation.explanation}
                </p>
              )}
              {explanation.bullets.length > 0 && (
                <ul className="space-y-2">
                  {explanation.bullets.map((bullet, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-gray-700 dark:text-neutral-300"
                    >
                      <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 dark:text-neutral-500">
        Version v1.0 • Scores are indicative and based on available data
      </div>
    </div>
  );
}
