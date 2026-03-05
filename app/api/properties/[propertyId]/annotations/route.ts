import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getPool } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { propertyId: param } = await params;
  const resolved = await resolvePropertyForUser(userId, param);
  if (!resolved) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const sp = request.nextUrl.searchParams;
  const startDate = sp.get("startDate");
  const endDate = sp.get("endDate");
  if (!startDate?.trim() || !endDate?.trim()) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  const pool = getPool();
  const res = await pool.query<{ id: string; date: string; label: string; color: string }>(
    `SELECT id::text, date::text, label, color
     FROM chart_annotations
     WHERE property_id = $1 AND date BETWEEN $2::date AND $3::date
     ORDER BY date`,
    [resolved.propertyId, startDate, endDate]
  );
  return NextResponse.json(
    res.rows.map((r) => ({ id: r.id, date: r.date, label: r.label, color: r.color }))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { propertyId: param } = await params;
  const resolved = await resolvePropertyForUser(userId, param);
  if (!resolved) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  let body: { date: string; label: string; color?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.date || !body.label?.trim()) {
    return NextResponse.json({ error: "date and label required" }, { status: 400 });
  }

  const pool = getPool();
  const res = await pool.query<{ id: string }>(
    `INSERT INTO chart_annotations (property_id, team_id, date, label, color)
     VALUES ($1, $2, $3::date, $4, $5)
     RETURNING id::text`,
    [resolved.propertyId, resolved.teamId, body.date, body.label.trim(), body.color ?? "default"]
  );
  const row = res.rows[0];
  return NextResponse.json({ id: row?.id, date: body.date, label: body.label.trim(), color: body.color ?? "default" });
}

export async function DELETE(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const pool = getPool();
  const res = await pool.query(
    `DELETE FROM chart_annotations
     WHERE id = $1::uuid AND team_id IN (SELECT team_id FROM team_members WHERE user_id = $2)
     RETURNING 1`,
    [id, userId]
  );
  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
