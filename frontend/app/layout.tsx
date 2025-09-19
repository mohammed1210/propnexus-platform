import './globals.css'
import 'leaflet/dist/leaflet.css';
import type { Metadata } from 'next'
import HeaderClient from '@/components/HeaderClient'
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'PropNexus',
  description: 'AI-powered property sourcing, analytics, and deal scoring',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <ToastProvider>
          {/* your header, etc. */}
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
