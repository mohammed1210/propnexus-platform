import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

const JWT_SECRET = process.env.JWT_SECRET!;
const COOKIE_NAME = "pnx_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.redirect(new URL("/login?err=token", req.url));
    const { payload } = await jose.jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    const email = payload.sub as string;
    const tier = (payload.tier as string) || "pro";

    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.set(COOKIE_NAME, JSON.stringify({ email, tier }), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    return res;
  } catch (e) {
    return NextResponse.redirect(new URL("/login?err=expired", req.url));
  }
}
