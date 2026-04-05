"use client";

import React from "react";
import { usePathname } from "next/navigation";
import UiOverlaysClient from "@/components/ui/UiOverlaysClient";
import BackToTop from "@/components/BackToTop";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";
import EnvValidator from "@/components/EnvValidator";

export default function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPrintOnlyDealPack = pathname?.endsWith("/deal-pack") ?? false;

  if (isPrintOnlyDealPack) {
    return (
      <ThemeProvider>
        <main id="main" tabIndex={-1} className="flex-1 outline-none" data-print-only-shell="deal-pack">
          {children}
        </main>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <EnvValidator />
      <Header />

      <main id="main" className="flex-1 focus:outline-none" data-site-shell="default">
        {children}
      </main>

      <Footer />
      <UiOverlaysClient />
      <BackToTop />
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  );
}
