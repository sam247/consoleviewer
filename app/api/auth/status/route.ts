import { NextResponse } from "next/server";
import { getSessionUserId, hasValidSession } from "@/lib/session";
import { getTeamIdForUser } from "@/lib/team";
import { getPool } from "@/lib/db";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    const validSession = userId ? true : await hasValidSession();

    if (!userId && !validSession) {
      return NextResponse.json({ signedIn: false, gscConnected: false, avatarUrl: null });
    }

    const pool = getPool();
    let gscConnected = false;
    let avatarUrl: string | null = null;

    if (userId) {
      const teamId = await getTeamIdForUser(userId);
      if (teamId) {
        const gscRes = await pool.query(
          `SELECT 1 FROM team_gsc_tokens WHERE team_id = $1`,
          [teamId]
        );
        gscConnected = (gscRes.rowCount ?? 0) > 0;
      }

      try {
        const profileRes = await pool.query(
          `SELECT avatar_url FROM user_profiles WHERE user_id = $1`,
          [userId]
        );
        avatarUrl = profileRes.rows[0]?.avatar_url ?? null;
      } catch {
        // user_profiles table may not exist yet — non-fatal
      }
    }

    return NextResponse.json({ signedIn: true, gscConnected, avatarUrl });
  } catch {
    return NextResponse.json({ signedIn: false, gscConnected: false, avatarUrl: null });
  }
}
