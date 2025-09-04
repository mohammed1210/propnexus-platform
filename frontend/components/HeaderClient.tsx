'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HeaderClient() {
  const [isDark, setIsDark] = useState(false);

  // Restore theme + patch Leaflet default marker icons (if Leaflet is present)
  useEffect(() => {
    // theme
    const dark = typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark';
    setIsDark(dark);
    document.body.classList.toggle('dark-mode', dark);

    // leaflet markers (safe no-op if leaflet isn't installed on this page)
    (async () => {
      try {
        const L = (await import('leaflet')).default;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.body.classList.toggle('dark-mode', next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    }
  };

  return (
    <header className="header-bar" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {/* Brand */}
      <Link href="/" className="text-xl font-extrabold text-purple-700 hover:opacity-90">PropNexus</Link>

      {/* Primary nav */}
      <nav style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
        <Link href="/listings" className="hover:underline">listings</Link>
        <Link href="/analytics" className="hover:underline">Analytics</Link>
        <Link href="/deals" className="hover:underline">Saved Deals</Link>
      </nav>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="mode-toggle rounded-md border px-2 py-1 text-sm"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        type="button"
      >
        {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>
    </header>
  );
}