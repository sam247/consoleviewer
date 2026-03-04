import { getPool } from "@/lib/db";
import { refreshAccessToken } from "@/lib/google-auth";

/**
 * Get a valid GSC access token for a team using the refresh token stored in team_gsc_tokens.
 * Returns null if the team has no token or refresh fails.
 */
export async function getAccessTokenForTeam(teamId: string): Promise<string | null> {
  const pool = getPool();
  const res = await pool.query<{ refresh_token: string }>(
    `SELECT refresh_token FROM team_gsc_tokens WHERE team_id = $1`,
    [teamId]
  );
  const refreshToken = res.rows[0]?.refresh_token;
  if (!refreshToken) return null;
  return refreshAccessToken(refreshToken);
}
