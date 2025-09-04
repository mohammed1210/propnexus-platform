'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HeaderClient() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // restore theme
    const dark = localStorage.getItem('theme') === 'dark';
    setIsDark(dark);
    document.body.classList.toggle('dark-mode', dark);

    // set Leaflet default marker icons (safe if Leaflet not used)
    (async () => {
      try {
        const L = (await import('leaflet')).default;
        const retina = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
        const normal = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
        const shadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
        L.Icon.Default.mergeOptions({ iconRetinaUrl: retina, iconUrl: normal, shadowUrl: shadow });
      } catch {
        /* no-op */
      }
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
      {/* Brand now routes home */}
      <Link
        href="/"
        className="font-extrabold tracking-tight hover:opacity-80"
        aria-label="Go to homepage"
      >
        PropNexus
      </Link>

      <nav style={{ marginLeft: 'auto', display: 'flex', gap: 12 }} aria-label="Primary">
        <Link href="/listings" className="hover:underline">Listings</Link>
        <Link href="/analytics" className="hover:underline">Analytics</Link>
        <Link href="/deals" className="hover:underline">Saved Deals</Link>
      </nav>

      <button onClick={toggleTheme} className="mode-toggle" style={{ marginLeft: 12 }}>
        {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>
    </header>
  );
}