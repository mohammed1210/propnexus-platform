"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Joyride, { type CallBackProps, STATUS, type Step } from 'react-joyride';

const TOUR_STORAGE_KEY = 'propnexus_onboarding_seen';

interface OnboardingTourProps {
  runNonce?: number;
  onSeenChange?: (seen: boolean) => void;
}

function isListingsRoute(pathname: string | null | undefined): boolean {
  const path = String(pathname || '').toLowerCase();
  // Intended routes: /listings and locale-prefixed /{locale}/listings.
  return /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?listings(?:\/|$)/.test(path);
}

export default function OnboardingTour({ runNonce = 0, onSeenChange }: OnboardingTourProps) {
  const pathname = usePathname();
  const onListings = isListingsRoute(pathname);
  const [mounted, setMounted] = useState(false);
  const [run, setRun] = useState(false);
  const [showFallbackBubble, setShowFallbackBubble] = useState(false);

  const steps: Step[] = useMemo(
    () => [
      {
        target: '[data-testid="onboarding-search-input"]',
        content: 'Type a city or postcode here to start hunting deals quickly.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-testid="onboarding-sort-select"]',
        content: 'Use this control to change how listings are ranked and sorted.',
        disableBeacon: true,
      },
      {
        target: '[data-testid="onboarding-more-filters"]',
        content: 'Open advanced filters to narrow by strategy and deal constraints.',
        disableBeacon: true,
      },
      {
        target: '[data-testid="onboarding-map-toggle"]',
        content: 'Switch map view on or off while keeping your current results.',
        disableBeacon: true,
      },
      {
        target: '[data-testid="onboarding-results-summary"]',
        content: 'Track how many listings match your current strategy as you refine filters.',
        disableBeacon: true,
      },
      {
        target: '[data-testid="theme-toggle"]',
        content: 'Pick dark or light mode anytime from the header.',
        placement: 'left',
        disableBeacon: true,
      },
    ],
    []
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!onListings) return;
    const alreadySeen = localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
    onSeenChange?.(alreadySeen);
    if (!alreadySeen) setRun(true);
  }, [onListings, onSeenChange]);

  useEffect(() => {
    if (!onListings || runNonce === 0) return;
    setRun(true);
    setShowFallbackBubble(false);
  }, [onListings, runNonce]);

  useEffect(() => {
    if (!onListings) return;

    const handleStartTour = () => {
      setRun(true);
      setShowFallbackBubble(false);
    };

    window.addEventListener('propnexus:start-tour', handleStartTour);
    return () => {
      window.removeEventListener('propnexus:start-tour', handleStartTour);
    };
  }, [onListings]);

  useEffect(() => {
    if (!run) {
      setShowFallbackBubble(false);
      return;
    }

    const t = window.setTimeout(() => {
      const joyrideTooltip =
        document.querySelector('.react-joyride__tooltip') ||
        document.querySelector('[role="dialog"]');
      setShowFallbackBubble(!joyrideTooltip);
    }, 700);

    return () => {
      window.clearTimeout(t);
    };
  }, [run]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      onSeenChange?.(true);
      setShowFallbackBubble(false);
      setRun(false);
    }
  };

  if (!mounted || !onListings) return null;

  return (
    <>
      <Joyride
        steps={steps}
        run={run}
        continuous
        scrollToFirstStep
        showSkipButton
        spotlightPadding={6}
        disableOverlayClose
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#0f766e',
            zIndex: 10000,
          },
        }}
      />

      {run && showFallbackBubble ? (
        <div
          data-testid="onboarding-fallback-bubble"
          className="fixed bottom-4 right-4 z-[10001] max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="text-sm text-slate-800 dark:text-slate-100">
            Type a city or postcode here to start hunting deals quickly.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-600"
              onClick={() => {
                localStorage.setItem(TOUR_STORAGE_KEY, 'true');
                onSeenChange?.(true);
                setShowFallbackBubble(false);
                setRun(false);
              }}
            >
              Close Tour
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
