'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HeaderClient() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const dark = localStorage.getItem('theme') === 'dark';
    setIsDark(dark);
    document.body.classList.toggle('dark-mode', dark);

    (async () => {
      try {
        const L = (await import('leaflet')).default;
        const retina = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
        const normal = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
        const shadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
        L.Icon.Default.mergeOptions({ iconRetinaUrl: retina, iconUrl: normal, shadowUrl: shadow });
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
    <header
      className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-white/75 dark:supports-[backdrop-filter]:bg-black/40 bg-white dark:bg-neutral-900 border-b border-neutral-200/70 dark:border-neutral-800/70"
    >
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-3">
        <Link href="/" className="font-extrabold tracking-tight hover:opacity-80" aria-label="Go to homepage">
          PropNexus
        </Link>

        <nav className="ml-auto flex items-center gap-1" aria-label="Primary">
          {[
            { href: '/listings', label: 'Listings' },
            { href: '/analytics', label: 'Analytics' },
            { href: '/deals', label: 'Saved Deals' },
          ].map(i => (
            <Link
              key={i.href}
              href={i.href}
              className="px-3 py-1.5 rounded-full text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {i.label}
            </Link>
          ))}
        </nav>

        <button onClick={toggleTheme} className="ml-2 rounded-full px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
          {isDark ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>
    </header>
  );
}