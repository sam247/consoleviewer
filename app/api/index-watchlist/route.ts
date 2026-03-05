import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getPool } from "@/lib/db";

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const propertyId = request.nextUrl.searchParams.get("propertyId");
  if (!propertyId?.trim()) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  const resolved = await resolvePropertyForUser(userId, propertyId.trim());
  if (!resolved) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const res = await getPool().query<{
    id: string;
    url: string;
    label: string | null;
    created_at: string;
  }>(
    `SELECT id::text AS id, url, label, created_at::text
     FROM index_watchlist
     WHERE owner_user_id = $1
       AND property_id = $2
     ORDER BY created_at DESC`,
    [userId, resolved.propertyId]
  );

  return NextResponse.json({ watchlist: res.rows ?? [] });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { propertyId: string; url: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { propertyId, url, label } = body;
  if (!propertyId?.trim() || !url?.trim()) {
    return NextResponse.json({ error: "propertyId and url required" }, { status: 400 });
  }

  const resolved = await resolvePropertyForUser(userId, propertyId.trim());
  if (!resolved) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  try {
    const insertRes = await getPool().query<{
      id: string;
      url: string;
      label: string | null;
      created_at: string;
    }>(
      `INSERT INTO index_watchlist (owner_user_id, property_id, url, label)
       VALUES ($1, $2, $3, $4)
       RETURNING id::text AS id, url, label, created_at::text`,
      [userId, resolved.propertyId, url.trim(), label?.trim() || null]
    );
    return NextResponse.json(insertRes.rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("duplicate key")) {
      return NextResponse.json({ error: "URL already in watchlist" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
