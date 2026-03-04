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

  const startDate = request.nextUrl.searchParams.get("startDate");
  const endDate = request.nextUrl.searchParams.get("endDate");
  if (!startDate?.trim() || !endDate?.trim()) {
    return NextResponse.json(
      { error: "startDate and endDate required" },
      { status: 400 }
    );
  }

  const pool = getPool();
  const res = await pool.query<{
    query: string;
    clicks: number;
    impressions: number;
    avg_position: number;
  }>(
    `SELECT
       q.query_text AS query,
       SUM(g.clicks)::int AS clicks,
       SUM(g.impressions)::int AS impressions,
       (SUM(g.position_sum) / NULLIF(SUM(g.impressions), 0))::numeric AS avg_position
     FROM gsc_query_daily g
     JOIN query_dictionary q ON q.id = g.query_id
     WHERE g.property_id = $1 AND g.date BETWEEN $2::date AND $3::date
     GROUP BY g.query_id, q.query_text
     ORDER BY SUM(g.clicks) DESC
     LIMIT 50`,
    [resolved.propertyId, startDate, endDate]
  );

  return NextResponse.json(res.rows);
}
