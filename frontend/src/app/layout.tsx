// src/app/layout.tsx
import './globals.css';
import 'leaflet/dist/leaflet.css';
import type { ReactNode } from 'react';
import HeaderClient from '@/components/HeaderClient';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <HeaderClient />
        <div className="main-wrapper">{children}</div>
      </body>
    </html>
  );
}