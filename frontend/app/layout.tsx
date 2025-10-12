// frontend/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

// ✅ import client helpers statically
import UiOverlaysClient from '@/components/ui/UiOverlaysClient';
import BackToTop from '@/components/BackToTop';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://propnexus-platform.vercel.app'
  ),
  title: {
    default: 'PropNexus',
    template: '%s · PropNexus',
  },
  description:
    'AI-powered property sourcing: analyse yield & ROI, score deals, and track your portfolio.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    title: 'PropNexus',
    description: 'AI-powered property sourcing platform.',
    url: '/',
    siteName: 'PropNexus',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PropNexus',
    description: 'AI-powered property sourcing platform.',
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Accessible skip link */}
        <a className="skip-link" href="#main">
          Skip to content
        </a>

        {/* Your header renders via shell */}

        <main
          id="main"
          tabIndex={-1}
          className="min-h-[calc(100dvh-var(--header-h,56px))] focus:outline-none"
        >
          {children}
        </main>

        {/* Client-side helpers */}
        <UiOverlaysClient />
        <BackToTop />
      </body>
    </html>
  );
}
