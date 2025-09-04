// src/app/layout.tsx
import './globals.css';
import 'leaflet/dist/leaflet.css';
import type { ReactNode } from 'react';
import HeaderClient from '@/components/HeaderClient';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="main-wrapper">
          <HeaderClient />
          {children}
        </div>
      </body>
    </html>
  );
}