import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getSessionUserId } from "@/lib/session";

type Dimension = "query" | "page" | "keyword";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; viewId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { propertyId, viewId } = await params;
  const resolved = await resolvePropertyForUser(userId, propertyId);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as
    | { name?: string; state?: unknown; dimension?: Dimension }
    | null;
  const name = body?.name != null ? String(body.name).trim() : undefined;
  const state = body?.state;
  const dimension = body?.dimension;
  if (name === "") {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }
  if (dimension != null && dimension !== "query" && dimension !== "page" && dimension !== "keyword") {
    return NextResponse.json({ error: "Invalid dimension" }, { status: 400 });
  }

  const pool = getPool();
  const now = new Date().toISOString();
  const updates: string[] = ["updated_at = $5::timestamptz"];
  const values: unknown[] = [userId, resolved.propertyId, viewId, dimension ?? null, now];
  let idx = 6;

  if (name != null) {
    updates.push(`name = $${idx++}`);
    values.push(name);
  }
  if (state != null) {
    updates.push(`state = $${idx++}::jsonb`);
    values.push(JSON.stringify(state));
  }
  if (updates.length === 1) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  let res;
  try {
    res = await pool.query(
      `UPDATE saved_views
       SET ${updates.join(", ")}
       WHERE owner_user_id = $1 AND property_id = $2 AND id = $3::uuid
         AND ($4::text IS NULL OR dimension = $4::text)
       RETURNING id::text AS id,
                 name,
                 dimension,
                 state,
                 created_at::text AS created_at,
                 updated_at::text AS updated_at`,
      values
    );
  } catch (e) {
    const err = e as { code?: unknown };
    if (err?.code === "23505") {
      return NextResponse.json({ error: "View name already exists" }, { status: 409 });
    }
    throw e;
  }

  if (!res.rows?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ view: res.rows[0] });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; viewId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { propertyId, viewId } = await params;
  const resolved = await resolvePropertyForUser(userId, propertyId);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pool = getPool();
  const res = await pool.query(
    `DELETE FROM saved_views
     WHERE owner_user_id = $1 AND property_id = $2 AND id = $3::uuid
     RETURNING id`,
    [userId, resolved.propertyId, viewId]
  );

  if (!res.rows?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
