// frontend/app/layout.tsx (server component)
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../styles/design-tokens.css";
import RootShell from "@components/RootShell";
import Providers from "./providers";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://propnexus-platform.vercel.app";
const ABS = (p: string) => new URL(p, SITE_URL);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "PropNexus", template: "%s · PropNexus" },
  description:
    "AI-powered property sourcing: analyse yield & ROI, score deals, and track your portfolio.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: ABS("/"),
    title: "PropNexus",
    siteName: "PropNexus",
    description: "AI-powered property sourcing platform.",
    images: [
      {
        url: ABS("/og/cover.png"),
        width: 1200,
        height: 630,
        alt: "PropNexus – AI property sourcing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PropNexus",
    description: "AI-powered property sourcing platform.",
    images: [ABS("/og/cover.png")],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-50 rounded bg-zinc-900 px-3 py-2 text-white"
        >
          Skip to content
        </a>

        <Providers>
          <RootShell>{children}</RootShell>
        </Providers>
      </body>
    </html>
  );
}
