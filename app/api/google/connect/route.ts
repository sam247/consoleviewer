import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { ensureTeamForUser } from "@/lib/team";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";

/** Encode state as base64 JSON for CSRF: { team_id } */
function encodeState(teamId: string): string {
  return Buffer.from(JSON.stringify({ team_id: teamId }), "utf8").toString("base64url");
}

function getBaseUrl(request: NextRequest): string {
  const url = request.nextUrl;
  return url.origin || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
}

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/login", getBaseUrl(request)));
  }
  const teamId = await ensureTeamForUser(userId);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI must be set" },
      { status: 500 }
    );
  }
  const state = encodeState(teamId);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GSC_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  const url = `${AUTH_BASE}?${params.toString()}`;
  return NextResponse.redirect(url);
}
