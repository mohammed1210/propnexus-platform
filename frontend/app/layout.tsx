import type { Metadata } from 'next'
import './globals.css'
import HeaderClient from '@/components/HeaderClient'

export const metadata: Metadata = {
  title: 'PropNexus',
  description: 'AI-Powered Property Sourcing Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        {/* Sticky site header */}
        <header
          className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-zinc-200/70 dark:border-zinc-800/70"
          style={{ height: 'var(--site-header-h)' }}
        >
          <div className="max-w-6xl mx-auto px-4 h-full flex items-center">
            <HeaderClient />
          </div>
        </header>

        {/* Page content */}
        <main>{children}</main>
      </body>
    </html>
  )
}
