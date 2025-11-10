'use client';

import { useEffect, useRef } from 'react';
import { MapPoint } from '@/types/listings';

interface PropertyMapProps {
  points: MapPoint[];
  loading: boolean;
}

export default function PropertyMap({ points, loading }: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    // Load Leaflet dynamically
    const loadLeaflet = async () => {
      // Load Leaflet CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        document.head.appendChild(link);
      }

      // Load Leaflet JS
      const L = await import('leaflet');
      
      // Initialize map
      const map = L.map(mapRef.current!).setView([54.5, -2], 6);
      
      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Add markers
      if (points.length > 0) {
        const bounds: [number, number][] = [];
        
        points.forEach((point) => {
          const marker = L.marker([point.lat, point.lng]).addTo(map);
          marker.bindPopup(`
            <div class="p-2">
              <h3 class="font-bold text-sm">${point.title}</h3>
              ${point.price ? `<p class="text-xs mt-1">£${point.price.toLocaleString()}</p>` : ''}
              <a href="/property/${point.id}" class="text-xs text-indigo-600 hover:underline mt-1 block">View details →</a>
            </div>
          `);
          bounds.push([point.lat, point.lng]);
        });

        // Fit map to markers
        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      }

      return () => {
        map.remove();
      };
    };

    loadLeaflet();
  }, [points]);

  if (loading) {
    return (
      <div className="h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
