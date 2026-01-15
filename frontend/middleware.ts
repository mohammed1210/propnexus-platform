// Clerk App Router middleware using official clerkMiddleware.
// Includes existing redirect logic while delegating auth/session handling to Clerk.
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { hasValidClerkKey } from '@/lib/clerk-utils';
import { isAuthEnabled } from '@/lib/auth';

function parseAdminEmails(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Legacy path redirect handler
function handleRedirects(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Existing legacy path aliases → canonical routes
  if (pathname === '/saved' || pathname === '/saved-deals-deals') {
    return NextResponse.redirect(new URL('/saved-deals', req.url));
  }
  if (pathname === '/off-market-deals') {
    return NextResponse.redirect(new URL('/off-market', req.url));
  }
  // Default continue
  return NextResponse.next();
}

// Use Clerk middleware only if keys are configured, otherwise just handle redirects
export default async function middleware(req: NextRequest, evt: NextFetchEvent) {
  const pk = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').trim();
  const sk = (process.env.CLERK_SECRET_KEY ?? '').trim();
  const enabled = isAuthEnabled && hasValidClerkKey(pk) && Boolean(sk);

  const adminToken =
    process.env.OFF_MARKET_ADMIN_TOKEN ||
    process.env.IMPORT_ADMIN_TOKEN ||
    process.env.ADMIN_TOKEN ||
    '';

  if (!enabled) {
    return handleRedirects(req);
  }

  const { clerkMiddleware, createRouteMatcher, clerkClient } = await import(
    '@clerk/nextjs/server'
  );

  const isProtectedRoute = createRouteMatcher([
    '/listings(.*)',
    '/off-market(.*)',
    '/saved-deals(.*)',
    '/account(.*)',
    '/admin(.*)',
    '/api/admin(.*)',
  ]);

  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);

  return clerkMiddleware(async (auth, request) => {
    const redirectRes = handleRedirects(request);
    // If handleRedirects issued a redirect, return it immediately.
    if (redirectRes.headers.get('location')) return redirectRes;

    if (!isProtectedRoute(request)) {
      return redirectRes;
    }

    // Allow token-based admin API calls without a Clerk session.
    if (request.nextUrl.pathname.startsWith('/api/admin')) {
      const tokenHeader = request.headers.get('x-admin-token') ?? '';
      if (adminToken && tokenHeader && tokenHeader === adminToken) {
        return redirectRes;
      }
    }

    const a = await auth();
    if (!a.userId) {
      const url = new URL('/sign-in', request.url);
      url.searchParams.set('redirect_url', request.url);
      return NextResponse.redirect(url);
    }

    if (
      request.nextUrl.pathname.startsWith('/admin') ||
      request.nextUrl.pathname.startsWith('/api/admin')
    ) {
      // Default-deny if ADMIN_EMAILS isn't configured.
      if (adminEmails.length === 0) {
        return NextResponse.redirect(new URL('/account?forbidden=admin', request.url));
      }

      let email: string | null = null;

      // Try to read email from session claims (fast path).
      const claims: any = a.sessionClaims;
      email =
        claims?.email ??
        claims?.primary_email ??
        claims?.primaryEmail ??
        claims?.primary_email_address ??
        null;

      // Fallback: fetch from Clerk if claims don't include an email.
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

      const normalized = (email || '').trim().toLowerCase();
      if (!normalized || !adminEmails.includes(normalized)) {
        return NextResponse.redirect(new URL('/account?forbidden=admin', request.url));
      }
    }

    return redirectRes;
  })(req, evt);
}

// Official matcher pattern plus explicit legacy aliases to ensure execution.
export const config = {
  matcher: [
    // Skip Next.js internals & static assets
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // API & trpc routes
    '/(api|trpc)(.*)',
    // Legacy alias paths (explicit)
    '/saved',
    '/saved-deals-deals',
    '/off-market-deals'
  ],
};
