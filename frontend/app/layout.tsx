// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import UiOverlaysClient from '@components/ui/UiOverlaysClient';
import BackToTop from '@components/BackToTop';
import Header from '@components/Header';
import { ThemeProvider } from '@components/ThemeProvider';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://propnexus-platform.vercel.app';
const ABS = (p: string) => new URL(p, SITE_URL); // helper to build absolute URLs

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://propnexus-platform.vercel.app',
  ),
  title: {
    default: 'PropNexus',
    template: '%s · PropNexus',
  },
  description:
    'AI-powered property sourcing: analyse yield & ROI, score deals, and track your portfolio.',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  alternates: {
    canonical: '/',
    languages: { 'en-GB': '/en-GB', en: '/' },
  },
  openGraph: {
    type: 'website',
    url: ABS('/'),
    title: 'PropNexus',
    siteName: 'PropNexus',
    description: 'AI-powered property sourcing platform.',
    images: [
      {
        url: ABS('/og/cover.png'),
        width: 1200,
        height: 630,
        alt: 'PropNexus – AI property sourcing',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PropNexus',
    description: 'AI-powered property sourcing platform.',
    images: [ABS('/og/cover.png')],
    creator: '@propnexus',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: ['/favicon.ico'],
  },
  manifest: ABS('/site.webmanifest').toString(),
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
  width: 'device-width',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Skip link for a11y */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 bg-zinc-900 text-white px-3 py-2 rounded"
        >
          Skip to content
        </a>

        <ThemeProvider>
          {/* ✅ App Header (includes conditional Billing link) */}
          <Header />

          <main id="main" className="min-h-[calc(100dvh-var(--header-h,56px))] focus:outline-none">
            {children}
          </main>

          {/* Client-side helpers */}
          <UiOverlaysClient />
          <BackToTop />
        </ThemeProvider>
      </body>
    </html>
  );
}
