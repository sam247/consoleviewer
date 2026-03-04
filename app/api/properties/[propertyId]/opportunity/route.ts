import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getPool } from "@/lib/db";

export async function GET(
  _request: NextRequest,
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

  const pool = getPool();
  const latestRes = await pool.query<{ max: string }>(
    `SELECT MAX(date)::text AS max FROM property_snapshots WHERE property_id = $1`,
    [resolved.propertyId]
  );
  const latestDate = latestRes.rows[0]?.max;
  if (!latestDate) {
    return NextResponse.json([]);
  }

  const res = await pool.query<{
    query_text: string;
    score: number;
    clicks: number;
    impressions: number;
    position_sum: number;
  }>(
    `SELECT q.query_text, o.score, o.clicks, o.impressions, o.position_sum
     FROM opportunity_queries o
     JOIN query_dictionary q ON q.id = o.query_id
     WHERE o.property_id = $1 AND o.date = $2::date
     ORDER BY o.score DESC
     LIMIT 25`,
    [resolved.propertyId, latestDate]
  );

  const rows = res.rows.map((r) => ({
    query: r.query_text,
    score: Number(r.score),
    clicks: Number(r.clicks),
    impressions: Number(r.impressions),
    avg_position:
      Number(r.impressions) > 0 ? Number(r.position_sum) / Number(r.impressions) : 0,
  }));

  return NextResponse.json(rows);
}
