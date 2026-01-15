"use client";

import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { isAuthEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  if (!isAuthEnabled) {
    return (
      <div style={{ maxWidth: 520, margin: "48px auto", padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Sign in</h1>
        <p style={{ opacity: 0.8 }}>Authentication is currently disabled.</p>
        <Link
          href="/"
          style={{ display: "inline-block", marginTop: 16, textDecoration: "underline" }}
        >
          Go back home
        </Link>
      </div>
    );
  }

  const afterSignInUrl = process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL ?? "/listings";
  const signUpUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? "/sign-up";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-brand-xl bg-gradient-to-br from-brand-500 to-cyan-500 items-center justify-center mb-4 shadow-brand-lg">
            <span className="text-white font-bold text-2xl">PN</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome back</h1>
          <p className="text-slate-600 text-sm">Sign in to continue to your listings.</p>
        </div>

        <div className="bg-white rounded-brand-xl border border-slate-200 shadow-brand-xl p-6">
          <SignIn
            appearance={{
              elements: {
                card: "border-0 shadow-none p-0",
              },
            }}
            routing="path"
            path="/sign-in"
            afterSignInUrl={afterSignInUrl}
            signUpUrl={signUpUrl}
          />
        </div>
      </div>
    </div>
  );
}
