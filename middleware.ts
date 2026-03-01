import { NextRequest, NextResponse } from "next/server";
import { getCookieName, verifySessionCookie } from "@/lib/session-edge";

const PUBLIC_PATHS = ["/login", "/api/auth/google", "/api/auth/callback/google", "/api/auth/app-login", "/s"];
const API_AUTH_PREFIX = "/api/auth/";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/_next") || path.startsWith("/favicon")) {
    return NextResponse.next();
  }
  for (const p of PUBLIC_PATHS) {
    if (path === p || path.startsWith(p + "/")) return NextResponse.next();
  }
  if (path.startsWith(API_AUTH_PREFIX)) {
    return NextResponse.next();
  }
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.next();
  }
  const cookie = request.cookies.get(getCookieName());
  if (!cookie?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const valid = await verifySessionCookie(cookie.value, secret);
  if (!valid) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.set(getCookieName(), "", { path: "/", maxAge: 0 });
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
