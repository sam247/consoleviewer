import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getTeamIdForUser } from "@/lib/team";
import { getPool } from "@/lib/db";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ signedIn: false, gscConnected: false, avatarUrl: null });
  }
  const pool = getPool();
  const teamId = await getTeamIdForUser(userId);

  const gscRes = teamId
    ? await pool.query(`SELECT 1 FROM team_gsc_tokens WHERE team_id = $1`, [teamId])
    : { rowCount: 0 };
  const gscConnected = (gscRes.rowCount ?? 0) > 0;

  const profileRes = await pool.query(
    `SELECT avatar_url FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  const avatarUrl = profileRes.rows[0]?.avatar_url ?? null;

  return NextResponse.json({ signedIn: true, gscConnected, avatarUrl });
}
