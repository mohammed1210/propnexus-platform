'use client';

import { useEffect, useRef } from 'react';

// Types for callers
export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  title?: string;
};

type Props = {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  onMarkerClick?: (id: string) => void;
  height?: number | string; // default 100%
};

// NOTE: This component is intended to be imported dynamically with { ssr: false }
// Example usage in a page:
//   const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function MapView({
  center = { lat: 51.4545, lng: -0.9781 }, // Reading as a sensible default
  zoom = 12,
  markers = [],
  onMarkerClick,
  height = 400,
}: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let L: any;
    let map: any;

    const init = async () => {
      // Dynamically import Leaflet only on client
      const leaflet = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      L = leaflet.default ?? leaflet;

      // Fix default icon paths under Next.js
      // @ts-ignore
      delete (L.Icon.Default as any).prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: (await import('leaflet/dist/images/marker-icon-2x.png')).default,
        iconUrl: (await import('leaflet/dist/images/marker-icon.png')).default,
        shadowUrl: (await import('leaflet/dist/images/marker-shadow.png')).default,
      });

      if (!mapEl.current) return;

      map = L.map(mapEl.current).setView([center.lat, center.lng], zoom);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      // Add markers
      markers.forEach((m) => {
        const marker = L.marker([m.lat, m.lng], { title: m.title ?? '' }).addTo(map);
        if (onMarkerClick) {
          marker.on('click', () => onMarkerClick(m.id));
        }
        if (m.title) {
          marker.bindTooltip(m.title);
        }
      });
    };

    init();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If markers change at runtime, you could add an effect to re-render them.
  // For now the map initializes once (typical for our dashboard).

  return (
    <div
      ref={mapEl}
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    />
  );
}
