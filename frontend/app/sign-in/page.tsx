"use client";

import Link from "next/link";
import { isAuthEnabled } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  if (!isAuthEnabled) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-brand-xl border border-slate-200 shadow-brand-xl p-6">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Sign in</h1>
          <p className="text-sm text-slate-600 mb-4">Authentication is currently disabled.</p>
          <Link href="/" className="text-brand-600 hover:text-brand-700 font-medium">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  const { SignIn } = require('@clerk/nextjs') as typeof import('@clerk/nextjs');

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-brand-xl bg-gradient-to-br from-brand-500 to-cyan-500 items-center justify-center mb-4 shadow-brand-lg">
            <span className="text-white font-bold text-2xl">PN</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome back</h1>
          <p className="text-slate-600 text-sm">Sign in to access your PropNexus dashboard.</p>
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
            signUpUrl="/sign-up"
          />
        </div>

        <p className="mt-6 text-xs text-slate-500 text-center">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="text-brand-600 hover:text-brand-700 font-medium">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-brand-600 hover:text-brand-700 font-medium">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
