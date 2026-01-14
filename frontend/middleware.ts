// Clerk App Router middleware using official clerkMiddleware.
// Includes existing redirect logic while delegating auth/session handling to Clerk.
import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hasValidClerkKey } from '@/lib/clerk-utils';
import { isAuthEnabled } from '@/lib/auth';

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
export default isAuthEnabled && hasValidClerkKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  ? clerkMiddleware((_auth, req) => handleRedirects(req))
  : handleRedirects;

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
