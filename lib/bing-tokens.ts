import { getPool } from "@/lib/db";
import { refreshBingAccessToken } from "@/lib/bing-auth";

/**
 * Get a valid Bing Webmaster access token for a team.
 * Returns null if the team has no token or refresh fails.
 */
export async function getBingAccessTokenForTeam(teamId: string): Promise<string | null> {
  const pool = getPool();
  const res = await pool.query<{ refresh_token: string }>(
    `SELECT refresh_token FROM team_bing_tokens WHERE team_id = $1`,
    [teamId]
  );
  const refreshToken = res.rows[0]?.refresh_token;
  if (!refreshToken) return null;
  return refreshBingAccessToken(refreshToken);
}
