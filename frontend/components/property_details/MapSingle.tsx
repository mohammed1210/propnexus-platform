"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";

type MinimalProperty = {
  lat?: number | string | null;
  lng?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  lon?: number | string | null;
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

function toCoordinate(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isValidCoordinate(lat: number | undefined, lng: number | undefined): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function MapFocus({ position, zoom }: { position: LatLngExpression; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    const focusMap = () => {
      map.invalidateSize({ animate: false });
      map.setView(position, zoom, { animate: false });
    };

    focusMap();
    const timers = [window.setTimeout(focusMap, 80), window.setTimeout(focusMap, 250)];
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(focusMap) : null;
    observer?.observe(map.getContainer());
    window.addEventListener('resize', focusMap);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer?.disconnect();
      window.removeEventListener('resize', focusMap);
    };
  }, [map, position, zoom]);

  return null;
}

export default function MapSingle(props: MapSingleProps) {
  const lat = toCoordinate(props.property?.latitude ?? props.property?.lat ?? props.latitude);
  const lng = toCoordinate(props.property?.longitude ?? props.property?.lng ?? props.property?.lon ?? props.longitude);
  const title = props.property?.title ?? props.title ?? 'Property';

  const height = props.height ?? 320;
  const zoom = props.zoom ?? 13;
  const scrollWheelZoom = props.scrollWheelZoom ?? false;

  const hasCoords = isValidCoordinate(lat, lng);
  const position: LatLngExpression = useMemo(
    () => (hasCoords ? [lat, lng as number] : [52.5, -1.5]),
    [hasCoords, lat, lng],
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    try {
      if (typeof document !== 'undefined' && !document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = '/leaflet/leaflet.css';
        document.head.appendChild(link);
      }

      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "/leaflet/marker-icon-2x.png",
        iconUrl: "/leaflet/marker-icon.png",
        shadowUrl: "/leaflet/marker-shadow.png",
      });
    } catch {}
  }, []);

  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    const isDark = () => document.body.classList.contains("dark-mode");
    setDarkMode(isDark());
    const obs = new MutationObserver(() => setDarkMode(isDark()));
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
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

  const lightUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const lightAttr = "&copy; OpenStreetMap contributors";
  const darkUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const darkAttr = "&copy; OpenStreetMap contributors, &copy; CARTO";

  return (
    <div
      className={`rounded-lg overflow-hidden ${props.className ?? ""}`}
      style={{ height, width: "100%" }}
    >
      <MapContainer
        center={position}
        zoom={zoom}
        scrollWheelZoom={scrollWheelZoom}
        style={{ height: "100%", width: "100%" }}
      >
        <MapFocus position={position} zoom={zoom} />
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
