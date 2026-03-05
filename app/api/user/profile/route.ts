import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getPool } from "@/lib/db";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  const res = await pool.query(
    `SELECT display_name, email, avatar_url FROM user_profiles WHERE user_id = $1`,
    [userId]
  );

  const row = res.rows[0];
  return NextResponse.json({
    displayName: row?.display_name ?? "",
    email: row?.email ?? userId,
    avatarUrl: row?.avatar_url ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 100) : null;
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 255) : null;
  const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.slice(0, 500_000) : null;

  const pool = getPool();
  await pool.query(
    `INSERT INTO user_profiles (user_id, display_name, email, avatar_url, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           email = EXCLUDED.email,
           avatar_url = EXCLUDED.avatar_url,
           updated_at = now()`,
    [userId, displayName, email, avatarUrl]
  );

  return NextResponse.json({ ok: true });
}
