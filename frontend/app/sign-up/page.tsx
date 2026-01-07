"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { isValidClerkKey } from "@/lib/clerk-utils";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Dynamically import SignUp component to avoid build errors when Clerk is not configured
const SignUp = dynamic(() => import("@clerk/nextjs").then(mod => ({ default: mod.SignUp })), {
  ssr: false,
});

export default function SignUpPage() {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  
  if (!isValidClerkKey(pk)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-900 mb-4">Authentication Not Configured</h1>
            <p className="text-slate-600">Clerk authentication is not configured for this environment.</p>
            <p className="text-slate-600 mt-2">Please use <Link href="/magic-login" className="text-brand-600 hover:text-brand-700 font-medium">Magic Link Login</Link> instead.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-brand-xl bg-gradient-to-br from-brand-500 to-cyan-500 items-center justify-center mb-4 shadow-brand-lg">
            <span className="text-white font-bold text-2xl">PN</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create your account</h1>
          <p className="text-slate-600 text-sm">Get started with AI-powered property sourcing in minutes.</p>
        </div>

        <div className="bg-white rounded-brand-xl border border-slate-200 shadow-brand-xl p-6">
          <SignUp
            appearance={{
              elements: {
                card: "border-0 shadow-none p-0",
              },
            }}
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
          />
        </div>

        <p className="mt-6 text-xs text-slate-500 text-center">
          By creating an account, you agree to our{" "}
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
