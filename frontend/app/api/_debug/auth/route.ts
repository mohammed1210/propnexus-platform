import { NextResponse } from "next/server";
import { disableAuth, disableAuthRaw, isAuthEnabled } from "@/lib/auth";

export const runtime = "nodejs"; // ensure server runtime

export async function GET() {
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const secret = process.env.CLERK_SECRET_KEY ?? "";

  return NextResponse.json({
    disableAuthRaw,
    disableAuth,
    hasPublishableKey: Boolean(publishable),
    hasSecretKey: Boolean(secret),
    isAuthEnabled,
  });
}
