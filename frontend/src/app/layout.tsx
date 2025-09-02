// src/app/layout.tsx
'use client';

import './globals.css';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import { ReactNode, useEffect, useState } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  // Set up Leaflet default marker icons once on the client
  useEffect(() => {
    (async () => {
      try {
        // NOTE: the missing parenthesis caused your error
        const L = (await import('leaflet')).default;

        // Explicit icon URLs (some bundlers strip the default getters)
        const retina =
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
        const normal =
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
        const shadow =
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

        L.Icon.Default.mergeOptions({
          iconUrl: normal,
          iconRetinaUrl: retina,
          shadowUrl: shadow,
        });
      } catch (e) {
        // If Leaflet isn’t on this page, silently ignore
        console.debug('Leaflet init skipped:', e);
      }
    })();
  }, []);

  return (
    <html lang="en">
      <head />
      <body>
        <div className="main-wrapper">
          <Header />
          {children}
        </div>

        {/* Restore dark mode from localStorage */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const dark = localStorage.getItem('theme') === 'dark';
                if (dark) document.body.classList.add('dark-mode');
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}

function Header() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    setIsDarkMode(localStorage.getItem('theme') === 'dark');
  }, []);

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
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
        {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>
    </header>
  );
}