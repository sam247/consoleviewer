import { NextRequest, NextResponse } from "next/server";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(_request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI must be set in Vercel" },
      { status: 500 }
    );
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GSC_SCOPE,
    access_type: "offline",
    prompt: "consent",
  });
  const url = `${AUTH_BASE}?${params.toString()}`;
  return NextResponse.redirect(url);
}
