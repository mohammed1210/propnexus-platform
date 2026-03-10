"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Joyride, { type CallBackProps, STATUS, type Step } from 'react-joyride';

const TOUR_STORAGE_KEY = 'propnexus_onboarding_seen';

interface OnboardingTourProps {
  runNonce?: number;
  onSeenChange?: (seen: boolean) => void;
}

export default function OnboardingTour({ runNonce = 0, onSeenChange }: OnboardingTourProps) {
  const pathname = usePathname();
  const onListings = pathname?.startsWith('/listings') ?? false;
  const [run, setRun] = useState(false);

  const steps: Step[] = useMemo(
    () => [
      {
        target: '.search-location-input',
        content: 'Type a city or postcode here to start hunting deals quickly.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '.investment-type-select',
        content: 'Use this control to change how listings are ranked and sorted.',
        disableBeacon: true,
      },
      {
        target: '.more-filters-button',
        content: 'Open advanced filters to narrow by strategy and deal constraints.',
        disableBeacon: true,
      },
      {
        target: '.toggle-map-view',
        content: 'Switch map view on or off while keeping your current results.',
        disableBeacon: true,
      },
      {
        target: '.property-card:first-of-type',
        content: 'Each card is AI-assisted. Open one to view the full deal details.',
        disableBeacon: true,
      },
      {
        target: '.dark-mode-toggle',
        content: 'Pick dark or light mode anytime from the header.',
        placement: 'left',
        disableBeacon: true,
      },
    ],
    []
  );

  useEffect(() => {
    if (!onListings) return;
    const alreadySeen = localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
    onSeenChange?.(alreadySeen);
    if (!alreadySeen) setRun(true);
  }, [onListings, onSeenChange]);

  useEffect(() => {
    if (!onListings || runNonce === 0) return;
    setRun(true);
  }, [onListings, runNonce]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      onSeenChange?.(true);
      setRun(false);
    }
  };

  if (!onListings) return null;

  return (
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
  );
}
