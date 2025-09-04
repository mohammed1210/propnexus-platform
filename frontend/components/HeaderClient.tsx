'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HeaderClient() {
  const [isDark, setIsDark] = useState(false);

  // Restore theme + set Leaflet marker icons (safe if Leaflet isn't present)
  useEffect(() => {
    const dark = typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark';
    setIsDark(!!dark);
    document.body.classList.toggle('dark-mode', !!dark);

    (async () => {
      try {
        const L = (await import('leaflet')).default;
        const retina = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
        const normal = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
        const shadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
        L.Icon.Default.mergeOptions({ iconUrl: normal, iconRetinaUrl: retina, shadowUrl: shadow });
      } catch {
        // Leaflet not on this page; ignore.
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
      <h1 style={{ fontWeight: 800, marginRight: 8 }}>PropNexus</h1>

      <nav style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
        <Link className="hover:underline" href="/listings">Listings</Link>
        <Link className="hover:underline" href="/analytics">Analytics</Link>
        <Link className="hover:underline" href="/deals">Saved Deals</Link>
      </nav>

      <button onClick={toggleTheme} className="mode-toggle" style={{ marginLeft: 12 }}>
        {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>
    </header>
  );
}