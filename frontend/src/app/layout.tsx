// frontend/src/app/layout.tsx
import './globals.css';
import 'leaflet/dist/leaflet.css';
import type { ReactNode } from 'react';
import Script from 'next/script';
import HeaderClient from '@/components/HeaderClient';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Set initial theme BEFORE React hydrates to avoid mismatches */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            try {
              var dark = localStorage.getItem('theme') === 'dark';
              if (dark) document.body.classList.add('dark-mode');
              else document.body.classList.remove('dark-mode');
            } catch (e) {}
          `}
        </Script>

        <div className="main-wrapper">
          <HeaderClient />
          {children}
        </div>
      </body>
    </html>
  );
}