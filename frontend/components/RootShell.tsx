"use client";

import React from "react";
import UiOverlaysClient from "@components/ui/UiOverlaysClient";
import BackToTop from "@components/BackToTop";
import Header from "@components/Header";
import Footer from "@components/Footer";
import { ThemeProvider } from "@components/ThemeProvider";
import { Toaster } from "sonner";
import EnvValidator from "@components/EnvValidator";

export default function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <EnvValidator />
      <Header />

      <main id="main" className="flex-1 focus:outline-none">
        {children}
      </main>

      <Footer />
      <UiOverlaysClient />
      <BackToTop />
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  );
}
