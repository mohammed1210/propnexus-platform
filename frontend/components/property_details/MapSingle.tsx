'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';

type MinimalProperty = {
  latitude?: number | null;
  longitude?: number | null;
  title?: string | null;
};

type MapSingleProps = {
  property?: MinimalProperty;
  latitude?: number;
  longitude?: number;
  title?: string;
  /** Container height in px (default 320) */
  height?: number;
  /** Initial zoom (default 13) */
  zoom?: number;
  /** Enable/disable wheel zoom (default false) */
  scrollWheelZoom?: boolean;
  /** Extra class names for the outer container */
  className?: string;
};

export default function MapSingle(props: MapSingleProps) {
  const lat = props.property?.latitude ?? props.latitude;
  const lng = props.property?.longitude ?? props.longitude;
  const title = props.property?.title ?? props.title ?? 'Property';

  const height = props.height ?? 320;
  const zoom = props.zoom ?? 13;
  const scrollWheelZoom = props.scrollWheelZoom ?? false;

  const hasCoords =
    typeof lat === 'number' && !Number.isNaN(lat) && typeof lng === 'number' && !Number.isNaN(lng);

  const position: LatLngExpression = useMemo(
    () => (hasCoords ? [lat as number, lng as number] : [52.5, -1.5]),
    [hasCoords, lat, lng],
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    try {
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });
    } catch {}
  }, []);

  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    const isDark = () => document.body.classList.contains('dark-mode');
    setDarkMode(isDark());
    const obs = new MutationObserver(() => setDarkMode(isDark()));
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  if (!mounted) return null;

  if (!hasCoords) {
    return (
      <div
        className={`w-full rounded-md border border-gray-200 p-3 text-sm text-gray-600 ${props.className ?? ''}`}
      >
        Map unavailable — no coordinates provided.
      </div>
    );
  }

  const lightUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const lightAttr = '&copy; OpenStreetMap contributors';
  const darkUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const darkAttr = '&copy; OpenStreetMap contributors, &copy; CARTO';

  return (
    <div
      className={`rounded-lg overflow-hidden ${props.className ?? ''}`}
      style={{ height, width: '100%' }}
    >
      <MapContainer
        center={position}
        zoom={zoom}
        scrollWheelZoom={scrollWheelZoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution={darkMode ? darkAttr : lightAttr}
          url={darkMode ? darkUrl : lightUrl}
        />
        <Marker position={position}>
          <Popup>{title}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
