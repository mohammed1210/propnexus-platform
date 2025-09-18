import './globals.css'
import type { Metadata } from 'next'
import HeaderClient from '@/components/HeaderClient'

export const metadata: Metadata = {
  title: 'PropNexus',
  description: 'AI-powered property sourcing, analytics, and deal scoring',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <HeaderClient />
        {children}
      </body>
    </html>
  )
}