// Clerk App Router middleware using official clerkMiddleware.
// Includes existing redirect logic while delegating auth/session handling to Clerk.
import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export default clerkMiddleware((_auth, req) => {
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
});

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
