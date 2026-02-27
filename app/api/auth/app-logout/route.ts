import { NextRequest, NextResponse } from "next/server";
import { getCookieName } from "@/lib/session";

export async function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.set(getCookieName(), "", { path: "/", maxAge: 0 });
  return res;
}
