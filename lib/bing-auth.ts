/**
 * Bing Webmaster OAuth2: exchange authorization code for tokens, and refresh access token.
 * Uses env: BING_CLIENT_ID, BING_CLIENT_SECRET, BING_REDIRECT_URI.
 * Docs: https://learn.microsoft.com/en-us/bingwebmaster/oauth2
 */

const BING_AUTH_BASE = "https://www.bing.com/webmasters/oauth";
const BING_TOKEN_URL = `${BING_AUTH_BASE}/token`;

export interface BingTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

/** Exchange authorization code for access_token and refresh_token. */
export async function exchangeBingCodeForTokens(
  code: string,
  redirectUri: string
): Promise<BingTokenResponse> {
  const clientId = process.env.BING_CLIENT_ID;
  const clientSecret = process.env.BING_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("BING_CLIENT_ID and BING_CLIENT_SECRET must be set");
  }
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(BING_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bing token exchange failed: ${res.status} ${err}`);
  }
  return res.json() as Promise<BingTokenResponse>;
}

/** Exchange a refresh token for a new access token. */
export async function refreshBingAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.BING_CLIENT_ID;
  const clientSecret = process.env.BING_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(BING_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as BingTokenResponse;
  return data.access_token ?? null;
}
