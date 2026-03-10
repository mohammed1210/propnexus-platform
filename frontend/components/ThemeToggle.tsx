'use client';

import { useTheme } from './ThemeProvider';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <button
        className="rounded-md p-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors opacity-0"
        aria-label="Theme toggle loading"
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="dark-mode-toggle rounded-md h-10 px-3 inline-flex items-center gap-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <>
          <FiMoon className="w-5 h-5" />
          <span>Dark</span>
        </>
      ) : (
        <>
          <FiSun className="w-5 h-5" />
          <span>Light</span>
        </>
      )}
    </button>
  );
}
