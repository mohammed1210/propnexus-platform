"use client";

import React from 'react';
import UiOverlaysClient from '@components/ui/UiOverlaysClient';
import BackToTop from '@components/BackToTop';
import Header from '@components/Header';
import Footer from '@components/Footer';
import { ThemeProvider } from '@components/ThemeProvider';
import { Toaster } from 'sonner';
import EnvValidator from '@components/EnvValidator';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/nextjs';

export default function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        layout: {
          logoPlacement: 'outside',
          helpPageUrl: '/help',
        },
        variables: {
          colorPrimary: '#148898',
          colorText: '#020617',
          colorBackground: 'white',
          borderRadius: '12px',
          fontFamily: 'Inter, system-ui, sans-serif',
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className="flex flex-col min-h-screen">
          {/* Skip link for a11y */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 bg-zinc-900 text-white px-3 py-2 rounded"
          >
            Skip to content
          </a>

          <ThemeProvider>
            {/* Environment validation in development */}
            <EnvValidator />

            {/* Clerk auth header controls (minimal example) */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 text-sm">
              <SignedOut>
                <SignInButton mode="modal" />
                <SignUpButton mode="modal" />
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>

            {/* App Header (includes conditional Billing link) */}
            <Header />

            <main id="main" className="flex-1 focus:outline-none">
              {children}
            </main>

            {/* Footer with legal links */}
            <Footer />

            {/* Client-side helpers */}
            <UiOverlaysClient />
            <BackToTop />
            <Toaster position="top-right" richColors />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
