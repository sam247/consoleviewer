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
  const res = await pool.query<{ query_text: string; appearance: string }>(
    `SELECT q.query_text, s.appearance
     FROM gsc_search_appearance s
     JOIN query_dictionary q ON q.id = s.query_id
     WHERE s.property_id = $1 AND s.date BETWEEN $2::date AND $3::date`,
    [resolved.propertyId, startDate, endDate]
  );

  const byQuery = new Map<string, Set<string>>();
  for (const row of res.rows) {
    let set = byQuery.get(row.query_text);
    if (!set) {
      set = new Set();
      byQuery.set(row.query_text, set);
    }
    set.add(row.appearance);
  }
  const out: Record<string, string[]> = {};
  byQuery.forEach((set, key) => {
    out[key] = Array.from(set);
  });
  return NextResponse.json(out);
}
