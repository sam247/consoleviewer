import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getTeamIdForUser } from "@/lib/team";
import { getPool } from "@/lib/db";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = await getTeamIdForUser(userId);
  if (!teamId) {
    return NextResponse.json({ properties: [] });
  }
  const pool = getPool();
  const res = await pool.query<{ id: string; site_url: string; gsc_site_url: string | null }>(
    `SELECT id, site_url, gsc_site_url FROM properties WHERE team_id = $1 AND active = true ORDER BY site_url`,
    [teamId]
  );
  return NextResponse.json({ properties: res.rows });
}
