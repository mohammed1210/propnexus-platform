import { NextResponse } from "next/server";

export const runtime = "nodejs"; // ensure server runtime

export async function GET() {
  const disableAuthRaw = process.env.NEXT_PUBLIC_DISABLE_AUTH ?? "";
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const secret = process.env.CLERK_SECRET_KEY ?? "";

  const disableAuth =
    ["1", "true", "yes", "on"].includes(disableAuthRaw.trim().toLowerCase());

  const isAuthEnabled = !disableAuth && Boolean(publishable);

  return NextResponse.json({
    disableAuthRaw,
    disableAuth,
    hasPublishableKey: Boolean(publishable),
    hasSecretKey: Boolean(secret),
    isAuthEnabled,
  });
}
