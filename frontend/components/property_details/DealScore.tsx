// frontend/components/property_details/DealScore.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface PropertyData {
  score?: number | null;
  score_breakdown?: {
    version?: string;
    categories?: Record<string, number>;
  } | null;
  [key: string]: any;
}

interface DealScoreProps {
  property: PropertyData;
}

const MAX_POINTS: Record<string, number> = {
  yield: 20,
  roi: 20,
  price_to_rent: 15,
  area_demand: 15,
  crime_index_inverse: 15,
  schools_access: 15,
};

const CATEGORY_LABELS: Record<string, string> = {
  yield: 'Rental Yield',
  roi: 'ROI Potential',
  price_to_rent: 'Price-to-Rent',
  area_demand: 'Area Demand',
  crime_index_inverse: 'Safety Index',
  schools_access: 'Schools Access',
};

export default function DealScore({ property }: DealScoreProps) {
  const scoreRef = useRef<HTMLDivElement>(null);

  const scoreData = useMemo(() => {
    const score = property?.score;
    if (typeof score !== 'number') return null;

    const breakdown = property?.score_breakdown;
    const categories = breakdown && typeof breakdown === 'object' ? breakdown.categories : undefined;
    const version = breakdown && typeof breakdown === 'object' ? breakdown.version : undefined;

    return { score, categories: categories ?? undefined, version: version ?? undefined };
  }, [property]);

  // Animation state (kept from prior UX)
  const [isVisible, setIsVisible] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const element = scoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isVisible) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.2 },
    );

    observer.observe(element);
    return () => observer.unobserve(element);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !scoreData) return;

    const duration = 1000;
    const start = performance.now();
    const targetScore = scoreData.score;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);

      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(targetScore * easeProgress);

      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [isVisible, scoreData]);

  if (!scoreData) {
    return (
      <div className="text-gray-600 dark:text-neutral-400">
        <p>Score pending</p>
        <p className="mt-1 text-xs">
          This property doesn’t have a stored deal score yet.
        </p>
      </div>
    );
  }

  const { score, categories, version } = scoreData;

  const getScoreColor = (s: number) => {
    if (s >= 75) return 'text-green-600 dark:text-green-400';
    if (s >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div ref={scoreRef}>
      <div className="sticky top-3 z-10 -mx-2 px-2 py-2 mb-4 bg-white/80 dark:bg-slate-900/40 backdrop-blur rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`text-6xl font-bold ${getScoreColor(score)}`}>{Math.round(animatedScore)}</div>
            <div className="text-gray-600 dark:text-neutral-400">
              <div className="text-sm font-medium">AI Deal Score</div>
              <div className="text-xs">Out of 100</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-green-500" />
              Strong
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-yellow-500" />
              Average
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-red-500" />
              Weak
            </span>
          </div>
        </div>
      </div>

      {categories && (
        <div className="space-y-3 mb-4">
          {Object.entries(categories)
            .filter(([k, v]) => typeof v === 'number' && typeof MAX_POINTS[k] === 'number')
            .map(([key, value]) => {
              const max = MAX_POINTS[key];
              const percentage = max > 0 ? (value / max) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-neutral-300">
                      {CATEGORY_LABELS[key] ?? key}
                    </span>
                    <span className="text-gray-600 dark:text-neutral-400">
                      {value.toFixed(1)}/{max}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${
                        isVisible ? 'score-bar score-bar-glow' : ''
                      }`}
                      style={{
                        width: isVisible ? `${Math.max(0, Math.min(100, percentage))}%` : '0%',
                        background: 'linear-gradient(90deg, #6ae0ff, #7c6cff)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 dark:text-neutral-500">
        Version {version ?? 'v1.0'} • Scores are indicative and based on available data
      </div>
    </div>
  );
}
