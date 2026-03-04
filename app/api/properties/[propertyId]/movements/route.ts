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
    page_url: string | null;
    delta_1d: number | null;
    delta_7d: number | null;
    trend: string | null;
  }>(
    `SELECT q.query_text, p.page_url, r.delta_1d, r.delta_7d, r.trend
     FROM ranking_movements r
     JOIN query_dictionary q ON q.id = r.query_id
     LEFT JOIN page_dictionary p ON p.id = r.page_id
     WHERE r.property_id = $1 AND r.date = $2::date
     ORDER BY COALESCE(ABS(r.delta_7d), 0) DESC
     LIMIT 25`,
    [resolved.propertyId, latestDate]
  );

  const rows = res.rows.map((r) => ({
    query: r.query_text,
    page: r.page_url ?? undefined,
    delta_1d: r.delta_1d != null ? Number(r.delta_1d) : undefined,
    delta_7d: r.delta_7d != null ? Number(r.delta_7d) : undefined,
    trend: r.trend ?? undefined,
  }));

  return NextResponse.json(rows);
}
