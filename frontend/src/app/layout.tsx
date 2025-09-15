// src/app/layout.tsx
import './globals.css';
import 'leaflet/dist/leaflet.css';
import type { ReactNode } from 'react';
import HeaderClient from '@/components/HeaderClient';
import Link from 'next/link';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <HeaderClient />
        {/* Simple nav bar */}
        <nav className="bg-gray-100 dark:bg-gray-900 border-b px-6 py-3 flex gap-6">
          <Link href="/" className="hover:underline">Home</Link>
          <Link href="/pricing" className="hover:underline">Pricing</Link>
        </nav>
        <div className="main-wrapper">{children}</div>
      </body>
    </html>
  );
}