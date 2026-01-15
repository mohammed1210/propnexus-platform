import { isAuthEnabled } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  if (!isAuthEnabled) {
    return (
      <div style={{ maxWidth: 520, margin: "48px auto", padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Sign in</h1>
        <p style={{ opacity: 0.8 }}>Authentication is currently disabled.</p>
        <Link href="/" style={{ display: "inline-block", marginTop: 16, textDecoration: "underline" }}>
          Go back home
        </Link>
      </div>
    );
  }

  // If Clerk is enabled, render your Clerk SignIn component / UI
  redirect("/"); // or your actual sign-in flow page
}
