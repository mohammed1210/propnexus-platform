'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HeaderClient() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
<<<<<<< HEAD

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
      } catch {}
    })();
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.body.classList.toggle('dark-mode', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };
=======
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      root.dataset.theme = 'dark';
    } else {
      root.classList.remove('dark');
      delete (root as any).dataset?.theme;
    }
  }, [dark]);
>>>>>>> e766067 (fix: stable map + ts-ignore)

  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur header-shadow">
      <div className="mx-auto max-w-7xl px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-indigo-600 text-white grid place-items-center text-xs font-bold">
            PN
          </div>
          <Link href="/" className="font-semibold">PropNexus</Link>
        </div>

        <nav className="hidden sm:flex items-center gap-4 text-sm">
          <Link href="/listings" className="hover:underline">Listings</Link>
          <Link href="/analytics" className="hover:underline">Analytics</Link>
          <Link href="/deals" className="hover:underline">Saved Deals</Link>
        </nav>

        <button
          className="text-xs px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700"
          onClick={() => setDark((v) => !v)}
          aria-pressed={dark}
        >
          {dark ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}