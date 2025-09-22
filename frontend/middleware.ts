import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/saved-deals') {
    return NextResponse.redirect(new URL("/saved-deals', req.url));
  }
  if (pathname === '/off-market-deals') {
    return NextResponse.redirect(new URL('/off-market', req.url));
  }

  return NextResponse.next();
}
