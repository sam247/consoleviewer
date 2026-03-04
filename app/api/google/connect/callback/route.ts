import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google-auth";
import { getSessionUserId } from "@/lib/session";
import { getPool } from "@/lib/db";

function decodeState(state: string): { team_id: string } | null {
  try {
    const json = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { team_id?: string };
    if (typeof parsed?.team_id === "string") return { team_id: parsed.team_id };
  } catch {
    // ignore
  }
  return null;
}

/** Verify that userId is a member of the given team. */
async function isUserInTeam(userId: string, teamId: string): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2`,
    [teamId, userId]
  );
  return res.rowCount !== null && res.rowCount > 0;
}

function getBaseUrl(request: NextRequest): string {
  return request.nextUrl.origin || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const baseUrl = getBaseUrl(request);

  if (error) {
    return NextResponse.redirect(new URL(`/onboarding/sites?error=${encodeURIComponent(error)}`, baseUrl));
  }
  if (!code || !state || !redirectUri) {
    return NextResponse.redirect(new URL("/onboarding/sites?error=missing_params", baseUrl));
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  const decoded = decodeState(state);
  if (!decoded || !(await isUserInTeam(userId, decoded.team_id))) {
    return NextResponse.redirect(new URL("/onboarding/sites?error=invalid_state", baseUrl));
  }

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      return NextResponse.redirect(new URL("/onboarding/sites?error=no_refresh_token", baseUrl));
    }
    const pool = getPool();
    await pool.query(
      `INSERT INTO team_gsc_tokens (team_id, refresh_token, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (team_id) DO UPDATE SET refresh_token = EXCLUDED.refresh_token`,
      [decoded.team_id, refreshToken]
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.redirect(new URL(`/onboarding/sites?error=${encodeURIComponent(msg)}`, baseUrl));
  }

  return NextResponse.redirect(new URL("/onboarding/sites", baseUrl));
}
