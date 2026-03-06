import { NextRequest, NextResponse } from "next/server";
import { exchangeBingCodeForTokens } from "@/lib/bing-auth";
import { getSessionUserId } from "@/lib/session";
import { getPool } from "@/lib/db";

function getRedirectBase(request: NextRequest): string {
  return request.nextUrl.origin || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
}

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

async function isUserInTeam(userId: string, teamId: string): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2`,
    [teamId, userId]
  );
  return res.rowCount !== null && res.rowCount > 0;
}

export async function GET(request: NextRequest) {
  const base = getRedirectBase(request);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const redirectUri = process.env.BING_REDIRECT_URI;

  if (error) {
    return NextResponse.redirect(new URL(`/onboarding/sites?error=${encodeURIComponent(error)}`, base));
  }
  if (!code || !redirectUri) {
    return NextResponse.redirect(new URL("/onboarding/sites?error=missing_params", base));
  }
  if (!state) {
    return NextResponse.redirect(new URL("/onboarding/sites?error=invalid_state", base));
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/login", base));
  }

  const decoded = decodeState(state);
  if (!decoded || !(await isUserInTeam(userId, decoded.team_id))) {
    return NextResponse.redirect(new URL("/onboarding/sites?error=invalid_state", base));
  }

  try {
    const tokens = await exchangeBingCodeForTokens(code, redirectUri);
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      return NextResponse.redirect(new URL("/onboarding/sites?error=no_refresh_token", base));
    }
    const pool = getPool();
    await pool.query(
      `INSERT INTO team_bing_tokens (team_id, refresh_token, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (team_id) DO UPDATE SET
         refresh_token = EXCLUDED.refresh_token,
         created_at = now()`,
      [decoded.team_id, refreshToken]
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bing token exchange failed";
    return NextResponse.redirect(new URL(`/onboarding/sites?error=${encodeURIComponent(msg)}`, base));
  }

  return NextResponse.redirect(new URL("/onboarding/sites", base));
}
