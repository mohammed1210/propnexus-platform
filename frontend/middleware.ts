import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Old → new aliases
  if (pathname === '/saved' || pathname === '/saved-deals-deals') {
    return NextResponse.redirect(new URL('/saved-deals', req.url));
  }
  if (pathname === '/off-market-deals') {
    return NextResponse.redirect(new URL('/off-market', req.url));
  }

  return NextResponse.next();
}

// (optional) limit middleware to top-level paths we might alias
export const config = {
  matcher: ['/', '/saved', '/saved-deals-deals', '/off-market-deals'],
};
