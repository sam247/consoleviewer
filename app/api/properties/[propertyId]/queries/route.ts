import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getPool } from "@/lib/db";
import { getAccessTokenForTeam } from "@/lib/gsc-tokens";
import { querySearchAnalytics } from "@/lib/gsc";

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

  if (res.rows.length > 0) {
    return NextResponse.json(res.rows);
  }

  // Fallback to live GSC API
  const token = await getAccessTokenForTeam(resolved.teamId);
  if (!token) return NextResponse.json([]);

  const propRes = await pool.query<{ site_url: string; gsc_site_url: string | null }>(
    `SELECT site_url, gsc_site_url FROM properties WHERE id = $1`,
    [resolved.propertyId]
  );
  const gscUrl =
    propRes.rows[0]?.gsc_site_url ||
    `https://${(propRes.rows[0]?.site_url ?? "").replace(/^https?:\/\//, "")}`;

  try {
    const gscRes = await querySearchAnalytics(gscUrl, startDate, endDate, ["query"], { rowLimit: 50 }, token);
    const rows = (gscRes.rows ?? []).map((r) => ({
      query: r.keys[0] ?? "",
      clicks: r.clicks,
      impressions: r.impressions,
      avg_position: r.position,
    }));
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}
