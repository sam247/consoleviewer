import { getPool } from "@/lib/db";

/**
 * Get team_id for a user from team_members. Returns null if user has no team.
 */
export async function getTeamIdForUser(userId: string): Promise<string | null> {
  const pool = getPool();
  const res = await pool.query<{ team_id: string }>(
    `SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return res.rows[0]?.team_id ?? null;
}

/**
 * Ensure user has a team. If they have none, create "My Team" and add them as owner.
 * Returns team_id.
 */
export async function ensureTeamForUser(userId: string): Promise<string> {
  const existing = await getTeamIdForUser(userId);
  if (existing) return existing;

  const pool = getPool();
  const teamRes = await pool.query<{ id: string }>(
    `INSERT INTO teams (id, name, created_at)
     VALUES (gen_random_uuid(), 'My Team', now())
     RETURNING id`
  );
  const teamId = teamRes.rows[0]?.id;
  if (!teamId) throw new Error("Failed to create team");

  await pool.query(
    `INSERT INTO team_members (team_id, user_id, role, created_at)
     VALUES ($1, $2, 'owner', now())`,
    [teamId, userId]
  );
  return teamId;
}
