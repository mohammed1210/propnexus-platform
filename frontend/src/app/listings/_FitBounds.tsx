'use client';

import { useEffect } from 'react';
import type { LatLngBoundsExpression } from 'leaflet';
import { useMap } from 'react-leaflet';

type FitBoundsProps = {
  points: { lat: number; lng: number }[];
};

export default function FitBounds({ points }: FitBoundsProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length < 2) return;
    const bounds: LatLngBoundsExpression = points.map(p => [p.lat, p.lng]) as any;
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, points]);

  return null;
}