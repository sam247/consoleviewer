import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getTeamIdForUser } from "@/lib/team";
import { getPool } from "@/lib/db";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ signedIn: false, gscConnected: false });
  }
  const teamId = await getTeamIdForUser(userId);
  if (!teamId) {
    return NextResponse.json({ signedIn: true, gscConnected: false });
  }
  const pool = getPool();
  const res = await pool.query(
    `SELECT 1 FROM team_gsc_tokens WHERE team_id = $1`,
    [teamId]
  );
  const gscConnected = (res.rowCount ?? 0) > 0;
  return NextResponse.json({ signedIn: true, gscConnected });
}
