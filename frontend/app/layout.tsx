// app/layout.tsx (server component)
import type { Metadata, Viewport } from 'next';
import './globals.css';
import '../styles/design-tokens.css';
import RootShell from '@components/RootShell';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://propnexus-platform.vercel.app';
const ABS = (p: string) => new URL(p, SITE_URL);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'PropNexus',
    template: '%s · PropNexus',
  },
  description:
    'AI-powered property sourcing: analyse yield & ROI, score deals, and track your portfolio.',
  robots: {
    index: true,
    follow: true,
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
  },
};

export const viewport: Viewport = {
  width: 'device-width',
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
  return <RootShell>{children}</RootShell>;
}
