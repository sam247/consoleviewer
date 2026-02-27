/**
 * Catch-all for /api/auth/* – redirect to Google OAuth.
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/api/auth/google", request.url));
}
