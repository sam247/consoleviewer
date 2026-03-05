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
  const queryKeysParam = sp.get("queryKeys");
  if (!startDate?.trim() || !endDate?.trim() || !queryKeysParam) {
    return NextResponse.json(
      { error: "startDate, endDate, and queryKeys required" },
      { status: 400 }
    );
  }

  let queryKeys: string[];
  try {
    queryKeys = JSON.parse(decodeURIComponent(queryKeysParam)) as string[];
    if (!Array.isArray(queryKeys) || queryKeys.length > 50) {
      queryKeys = queryKeys.slice(0, 50);
    }
  } catch {
    return NextResponse.json({ error: "queryKeys must be a JSON array" }, { status: 400 });
  }

  if (queryKeys.length === 0) {
    return NextResponse.json({});
  }

  const pool = getPool();
  const res = await pool.query<{ query_text: string; date: string; avg_pos: number }>(
    `SELECT q.query_text, g.date::text,
            (g.position_sum / NULLIF(g.impressions, 0))::double precision AS avg_pos
     FROM gsc_query_daily g
     JOIN query_dictionary q ON q.id = g.query_id
     WHERE g.property_id = $1 AND g.date BETWEEN $2::date AND $3::date
       AND q.query_text = ANY($4::text[])
     ORDER BY q.query_text, g.date`,
    [resolved.propertyId, startDate, endDate, queryKeys]
  );

  const byQuery = new Map<string, number[]>();
  for (const row of res.rows) {
    let arr = byQuery.get(row.query_text);
    if (!arr) {
      arr = [];
      byQuery.set(row.query_text, arr);
    }
    arr.push(Number(row.avg_pos));
  }

  const out: Record<string, number[]> = {};
  byQuery.forEach((positions, key) => {
    out[key] = positions;
  });
  return NextResponse.json(out);
}
