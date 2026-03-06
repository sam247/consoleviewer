import { NextRequest, NextResponse } from "next/server";

const BING_AUTH_URL = "https://www.bing.com/webmasters/oauth/authorize";
const BING_SCOPE = "webmaster.manage";

export async function GET(request: NextRequest) {
  const clientId = process.env.BING_CLIENT_ID;
  const redirectUri = process.env.BING_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "BING_CLIENT_ID and BING_REDIRECT_URI must be set" },
      { status: 500 }
    );
  }
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: BING_SCOPE,
  });
  if (state) params.set("state", state);
  const url = `${BING_AUTH_URL}?${params.toString()}`;
  return NextResponse.redirect(url);
}
