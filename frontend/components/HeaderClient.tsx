'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HeaderClient() {
  const [isDark, setIsDark] = useState(false);

  // Theme restore + Leaflet marker icon setup
  useEffect(() => {
    // theme
    const dark = localStorage.getItem('theme') === 'dark';
    setIsDark(dark);
    document.body.classList.toggle('dark-mode', dark);

    // leaflet markers (safe to ignore if Leaflet isn’t on the page)
    (async () => {
      try {
        const L = (await import('leaflet')).default;
        const retina = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
        const normal = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
        const shadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
        L.Icon.Default.mergeOptions({
          iconUrl: normal,
          iconRetinaUrl: retina,
          shadowUrl: shadow,
        });
      } catch {}
    })();
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.body.classList.toggle('dark-mode', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <header className="header-bar" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Link href="/" style={{ textDecoration: 'none' }}>
        <h1>PropNexus</h1>
      </Link>

      <nav style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
        <Link href="/">Listings</Link>
        <Link href="/analytics">Analytics</Link>
        <Link href="/deals">Saved Deals</Link>
      </nav>

      <button onClick={toggleTheme} className="mode-toggle">
        {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>
    </header>
  );
}