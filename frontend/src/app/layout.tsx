// app/layout.tsx
import './globals.css';
import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <div className="main-wrapper">
          <Header />
          {children}
        </div>

        {/* Script: Restore dark mode from localStorage */}
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
    const currentTheme = localStorage.getItem('theme') === 'dark';
    setIsDarkMode(currentTheme);
  }, []);

  const toggleTheme = () => {
    const dark = !isDarkMode;
    setIsDarkMode(dark);
    document.body.classList.toggle('dark-mode', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  };

  return (
    <header className="header-bar">
      <Link href="/" style={{ textDecoration: 'none' }}>
        <h1>PropNexus</h1>
      </Link>
      <button onClick={toggleTheme} className="mode-toggle">
        {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>
    </header>
  );
}
