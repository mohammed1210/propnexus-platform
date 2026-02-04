'use client';

import { useEffect, useRef } from 'react';

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
  height?: number | string; // px or CSS size
};

/**
 * Lightweight Leaflet map that:
 * - Loads Leaflet only on the client
 * - Injects Leaflet CSS from CDN (avoids TS/webpack CSS issues)
 * - Uses CDN icon URLs to avoid importing images
 *
 * Import dynamically where used:
 *   const MapView = dynamic(() => import('@components/MapView'), { ssr: false });
 */
export default function MapView({
  center = { lat: 51.4545, lng: -0.9781 }, // Reading default
  zoom = 12,
  markers = [],
  onMarkerClick,
  height = 400,
}: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let L: any;

    const ensureLeafletCss = () => {
      if (typeof document === 'undefined') return;
      if (document.getElementById('leaflet-css')) return;
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = '/leaflet/leaflet.css';
      document.head.appendChild(link);
    };

    const init = async () => {
      ensureLeafletCss();

      const leaflet = await import('leaflet');
      L = leaflet.default ?? leaflet;

      // Fix default marker icons via CDN assets
      try {
        delete L.Icon.Default.prototype._getIconUrl;
      } catch {}
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl: '/leaflet/marker-icon.png',
        shadowUrl: '/leaflet/marker-shadow.png',
      });

      if (!mapEl.current) return;

      const map = L.map(mapEl.current).setView([center.lat, center.lng], zoom);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      // Add markers
      markers.forEach((m) => {
        const marker = L.marker([m.lat, m.lng], { title: m.title ?? '' }).addTo(map);
        if (m.title) marker.bindTooltip(m.title);
        if (onMarkerClick) marker.on('click', () => onMarkerClick(m.id));
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
