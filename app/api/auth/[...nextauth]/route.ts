/**
 * Auth stub. Replace with NextAuth or custom OAuth flow that:
 * 1. Redirects to Google consent with scope webmasters.readonly
 * 2. Handles callback, exchanges code for tokens, stores refresh token
 * 3. Provides getSession / getToken for API routes to call GSC
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Auth not configured. Add GOOGLE_CLIENT_ID and implement OAuth callback.",
  });
}

export async function POST() {
  return NextResponse.json({
    message: "Auth not configured.",
  });
}
