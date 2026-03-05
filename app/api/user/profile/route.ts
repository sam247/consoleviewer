import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getPool } from "@/lib/db";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
  } catch {
    return NextResponse.json({
      displayName: "",
      email: userId,
      avatarUrl: null,
    });
  }
}

const MAX_AVATAR_BYTES = 400_000; // ~400KB to stay under 1MB request body with name/email

export async function PUT(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { displayName?: unknown; email?: unknown; avatarUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON or payload too large. Try a smaller image." },
      { status: 400 }
    );
  }

  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 100) : null;
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 255) : null;
  const rawAvatar = typeof body.avatarUrl === "string" ? body.avatarUrl : null;
  const avatarUrl = rawAvatar ? rawAvatar.slice(0, MAX_AVATAR_BYTES) : null;

  try {
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
  } catch (err) {
    console.error("Profile save error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save profile" },
      { status: 500 }
    );
  }
}
