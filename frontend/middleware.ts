import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { hasValidClerkKey } from "@/lib/clerk-utils";
import { disableAuth, isAuthEnabled } from "@/lib/auth";
import { FF } from "@/lib/flags";

const DEFAULT_ADMIN_EMAILS = ["abbas_m90@hotmail.com", "ysoserious360@gmail.com"];
const OFF_MARKET_ENABLED = FF.OFF_MARKET;

function parseAdminEmails(raw: string | undefined): string[] {
  return (raw || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isOffMarketPath(pathname: string) {
  return pathname === "/off-market-deals" || pathname === "/off-market" || pathname.startsWith("/off-market/");
}

function handleRedirects(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Canonical Saved Deals route is `/saved`.
  if (pathname === "/saved-deals" || pathname === "/saved-deals-deals") {
    return NextResponse.redirect(new URL("/saved", req.url));
  }
  if (!OFF_MARKET_ENABLED && isOffMarketPath(pathname)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (OFF_MARKET_ENABLED && pathname === "/off-market-deals") {
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

const clerkAuthMiddleware = clerkMiddleware(async (auth, req) => {
  const redirectRes = handleRedirects(req);
  if (redirectRes.headers.get("location")) return redirectRes;

  const pk = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").trim();
  const sk = (process.env.CLERK_SECRET_KEY ?? "").trim();
  const enabled = isAuthEnabled && hasValidClerkKey(pk) && Boolean(sk);

  // If Clerk isn't enabled, fall back to plain Next.js middleware passthrough.
  if (!enabled) return NextResponse.next();

  const adminToken =
    process.env.OFF_MARKET_ADMIN_TOKEN ||
    process.env.IMPORT_ADMIN_TOKEN ||
    process.env.ADMIN_TOKEN ||
    "";

  if (req.nextUrl.pathname.startsWith("/api/admin")) {
    const tokenHeader = req.headers.get("x-admin-token") ?? "";
    if (adminToken && tokenHeader === adminToken) {
      // Admin-token access bypasses Clerk; let the request continue.
      return NextResponse.next();
    }
  }

  // Only enforce sign-in / admin rules for protected routes.
  if (isProtectedRoute(req)) {
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
  }

  // IMPORTANT: don't return a manual NextResponse.next() here.
  // Let `clerkMiddleware` produce the passthrough response so it can
  // inject the auth headers that `auth()` reads inside route handlers.
  return;
});

export default function middleware(req: NextRequest, evt: any) {
  if (process.env.SCREENSHOT_TEST === "true" || disableAuth) {
    const redirectRes = handleRedirects(req);
    if (redirectRes.headers.get("location")) return redirectRes;
    return NextResponse.next();
  }

  return clerkAuthMiddleware(req, evt);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files (including favicon)
    "/((?!_next|.*\\.(?:css|js|json|png|jpg|jpeg|gif|svg|ico|webp|map)|favicon.ico).*)",
    "/api/(.*)",
    // Explicitly match Saved Deals (belt & braces)
    "/saved(.*)",
  ],
};
