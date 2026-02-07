import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { hasValidClerkKey } from "@/lib/clerk-utils";
import { isAuthEnabled } from "@/lib/auth";

const DEFAULT_ADMIN_EMAILS = ["abbas_m90@hotmail.com", "ysoserious360@gmail.com"];

function parseAdminEmails(raw: string | undefined): string[] {
  return (raw || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function handleRedirects(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Canonical Saved Deals route is `/saved`.
  if (pathname === "/saved-deals" || pathname === "/saved-deals-deals") {
    return NextResponse.redirect(new URL("/saved", req.url));
  }
  if (pathname === "/off-market-deals") {
    return NextResponse.redirect(new URL("/off-market", req.url));
  }

  return NextResponse.next();
}

const isProtectedRoute = createRouteMatcher([
  "/listings(.*)",
  "/off-market(.*)",
  "/saved(.*)",
  "/saved-deals(.*)",
  "/account(.*)",
  "/admin(.*)",
  "/api/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const redirectRes = handleRedirects(req);
  if (redirectRes.headers.get("location")) return redirectRes;

  const pk = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").trim();
  const sk = (process.env.CLERK_SECRET_KEY ?? "").trim();
  const enabled = isAuthEnabled && hasValidClerkKey(pk) && Boolean(sk);

  if (!enabled) return redirectRes;
  if (!isProtectedRoute(req)) return redirectRes;

  const adminToken =
    process.env.OFF_MARKET_ADMIN_TOKEN ||
    process.env.IMPORT_ADMIN_TOKEN ||
    process.env.ADMIN_TOKEN ||
    "";

  if (req.nextUrl.pathname.startsWith("/api/admin")) {
    const tokenHeader = req.headers.get("x-admin-token") ?? "";
    if (adminToken && tokenHeader === adminToken) {
      return redirectRes;
    }
  }

  const a = await auth();
  if (!a.userId) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(url);
  }

  if (req.nextUrl.pathname.startsWith("/admin") || req.nextUrl.pathname.startsWith("/api/admin")) {
    const adminEmails = Array.from(
      new Set([
        ...parseAdminEmails(process.env.ADMIN_EMAILS),
        ...parseAdminEmails(process.env.NEXT_PUBLIC_ADMIN_EMAILS),
        ...DEFAULT_ADMIN_EMAILS,
      ])
    );

    if (adminEmails.length === 0) {
      return NextResponse.redirect(new URL("/account?forbidden=admin", req.url));
    }

    const claims: any = a.sessionClaims;
    let email =
      claims?.email ??
      claims?.primary_email ??
      claims?.primaryEmail ??
      claims?.primary_email_address ??
      null;

    if (!email && a.userId) {
      try {
        const client = await clerkClient();
        const user = await client.users.getUser(a.userId);
        email =
          user.primaryEmailAddress?.emailAddress ??
          user.emailAddresses?.[0]?.emailAddress ??
          null;
      } catch {
        email = null;
      }
    }

    const normalized = (email || "").trim().toLowerCase();
    if (!normalized || !adminEmails.includes(normalized)) {
      return NextResponse.redirect(new URL("/account?forbidden=admin", req.url));
    }
  }

  return redirectRes;
});

export const config = {
  matcher: [
    "/listings(.*)",
    "/off-market(.*)",
    "/saved(.*)",
    "/saved-deals(.*)",
    "/account(.*)",
    "/admin(.*)",
    "/api/admin(.*)",
  ],
};
