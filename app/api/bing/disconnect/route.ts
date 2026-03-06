import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getTeamIdForUser } from "@/lib/team";
import { getPool } from "@/lib/db";

/**
 * Disconnect Bing Webmaster for the current user's team: remove the stored refresh token.
 */
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = await getTeamIdForUser(userId);
  if (!teamId) {
    return NextResponse.json({ error: "No team" }, { status: 400 });
  }
  const pool = getPool();
  await pool.query(`DELETE FROM team_bing_tokens WHERE team_id = $1`, [teamId]);
  return NextResponse.json({ ok: true });
}
