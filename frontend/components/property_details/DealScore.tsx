// frontend/components/property_details/DealScore.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AIScoreBars from '@/components/property_details/AIScoreBars';
import { normalizeProperty } from '@/lib/normalizeProperty';

interface PropertyData {
  ai_score?: number | null;
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

function percentToScore20(pct: number) {
  // 0% => 0 points, 10%+ => 20 points
  const clamped = Math.max(0, Math.min(10, pct));
  return (clamped / 10) * 20;
}

export default function DealScore({ property }: DealScoreProps) {
  const scoreRef = useRef<HTMLDivElement>(null);

  const normalized = useMemo(() => normalizeProperty(property as any), [property]);

  const scoreData = useMemo(() => {
    const score =
      typeof property?.score === 'number'
        ? property.score
        : typeof property?.ai_score === 'number'
          ? property.ai_score
          : null;
    if (typeof score !== 'number') return null;

    const breakdown = property?.score_breakdown;
    const categories = breakdown && typeof breakdown === 'object' ? breakdown.categories : undefined;
    const version = breakdown && typeof breakdown === 'object' ? breakdown.version : undefined;

    return { score, categories: categories ?? undefined, version: version ?? undefined };
  }, [property]);

  const derivedCategories = useMemo(() => {
    const categories = scoreData?.categories;
    if (!categories) return categories;

    const roiPctForScore = normalized.roiPercent ?? normalized.roiProxyPercent ?? 0;
    const roiScoreFallback = percentToScore20(roiPctForScore);
    const current = typeof categories.roi === 'number' ? categories.roi : 0;

    return {
      ...categories,
      roi: current > 0 ? current : roiScoreFallback,
    };
  }, [scoreData?.categories, normalized.roiPercent, normalized.roiProxyPercent]);

  const chartItems = useMemo(() => {
    if (!derivedCategories) return [];

    return Object.entries(derivedCategories)
      .filter(([key, value]) => typeof value === 'number' && typeof MAX_POINTS[key] === 'number')
      .map(([key, value]) => {
        const max = MAX_POINTS[key];
        const percentage = max > 0 ? (value / max) * 100 : 0;
        return {
          label: CATEGORY_LABELS[key] ?? key,
          value: Math.round(Math.max(0, Math.min(100, percentage))),
        };
      });
  }, [derivedCategories]);

  // Animation state (kept from prior UX)
  const [isVisible, setIsVisible] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    if (scoreData) {
      setAnimatedScore(scoreData.score);
    }
  }, [scoreData]);

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
    const startScore = animatedScore;

    if (Math.round(startScore) === Math.round(targetScore)) {
      return;
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);

      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(startScore + (targetScore - startScore) * easeProgress);

      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [animatedScore, isVisible, scoreData]);

  if (!scoreData) return null;

  const { score, version } = scoreData;

  const showBreakdown = chartItems.length > 0;

  const barGradient =
    'bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 dark:from-red-400 dark:via-yellow-400 dark:to-green-400';

  const getScoreColor = (s: number) => {
    if (s >= 75) return 'text-green-600 dark:text-green-400';
    if (s >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div ref={scoreRef}>
      <div className="sticky top-3 z-10 px-2 py-2 mb-4 bg-white/80 dark:bg-slate-900/40 backdrop-blur rounded-lg">
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

      {showBreakdown ? (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <AIScoreBars overall={Math.round(score)} items={chartItems} showHeader={false} />
        </div>
      ) : null}

      {showBreakdown ? (
        <div className="mt-4 text-xs text-gray-500 dark:text-neutral-500">
          Version {version ?? 'v1.0'} • Scores are indicative and based on available data
        </div>
      ) : null}
    </div>
  );
}
