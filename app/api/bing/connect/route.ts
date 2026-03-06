import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { ensureTeamForUser } from "@/lib/team";

const BING_AUTH_URL = "https://www.bing.com/webmasters/oauth/authorize";
const BING_SCOPE = "webmaster.manage";

function encodeState(teamId: string): string {
  return Buffer.from(JSON.stringify({ team_id: teamId }), "utf8").toString("base64url");
}

function getBaseUrl(request: NextRequest): string {
  return request.nextUrl.origin || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
}

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/login", getBaseUrl(request)));
  }
  const teamId = await ensureTeamForUser(userId);
  const clientId = process.env.BING_CLIENT_ID;
  const redirectUri = process.env.BING_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "BING_CLIENT_ID and BING_REDIRECT_URI must be set" },
      { status: 500 }
    );
  }
  const state = encodeState(teamId);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: BING_SCOPE,
    state,
  });
  const url = `${BING_AUTH_URL}?${params.toString()}`;
  return NextResponse.redirect(url);
}
