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

  const sp = request.nextUrl.searchParams;
  const pageUrl = sp.get("pageUrl");
  const startDate = sp.get("startDate");
  const endDate = sp.get("endDate");
  if (!pageUrl?.trim() || !startDate?.trim() || !endDate?.trim()) {
    return NextResponse.json(
      { error: "pageUrl, startDate, and endDate required" },
      { status: 400 }
    );
  }

  const pool = getPool();

  const pageRes = await pool.query<{ id: string; page_hash: Buffer }>(
    `SELECT id, page_hash FROM page_dictionary WHERE page_url = $1 LIMIT 1`,
    [pageUrl.trim()]
  );
  const pageRow = pageRes.rows[0];
  if (pageRow) {
    const res = await pool.query<{ query: string; clicks: number; impressions: number; position: number }>(
      `SELECT
         q.query_text AS query,
         SUM(r.clicks)::int AS clicks,
         SUM(r.impressions)::int AS impressions,
         (SUM(r.position * r.impressions) / NULLIF(SUM(r.impressions), 0))::numeric(8,2) AS position
       FROM gsc_raw r
       JOIN query_dictionary q ON q.query_hash = r.query_hash
       WHERE r.property_id = $1 AND r.date BETWEEN $2::date AND $3::date AND r.page_hash = $4
       GROUP BY q.id, q.query_text
       ORDER BY SUM(r.clicks) DESC
       LIMIT 200`,
      [resolved.propertyId, startDate, endDate, pageRow.page_hash]
    );
    const queries = res.rows.map((r) => ({
      query: r.query,
      clicks: r.clicks,
      impressions: r.impressions,
      position: Number(r.position),
    }));
    const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);
    const totalImpressions = queries.reduce((s, q) => s + q.impressions, 0);
    return NextResponse.json({ queries, totalClicks, totalImpressions });
  }

  const token = await getAccessTokenForTeam(resolved.teamId);
  if (!token) {
    return NextResponse.json({ queries: [], totalClicks: 0, totalImpressions: 0 });
  }

  const propRes = await pool.query<{ site_url: string; gsc_site_url: string | null }>(
    `SELECT site_url, gsc_site_url FROM properties WHERE id = $1`,
    [resolved.propertyId]
  );
  const gscUrl =
    propRes.rows[0]?.gsc_site_url ??
    `https://${(propRes.rows[0]?.site_url ?? "").replace(/^https?:\/\//, "")}`;

  try {
    const gscRes = await querySearchAnalytics(
      gscUrl,
      startDate,
      endDate,
      ["query"],
      {
        dimensionFilterGroups: [
          {
            groupType: "and",
            filters: [{ dimension: "page", operator: "equals", expression: pageUrl.trim() }],
          },
        ],
        rowLimit: 200,
      },
      token
    );
    const queries = (gscRes.rows ?? []).map((r) => ({
      query: r.keys[0] ?? "",
      clicks: r.clicks,
      impressions: r.impressions,
      position: r.position ?? 0,
    }));
    const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);
    const totalImpressions = queries.reduce((s, q) => s + q.impressions, 0);
    return NextResponse.json({ queries, totalClicks, totalImpressions });
  } catch {
    return NextResponse.json({ queries: [], totalClicks: 0, totalImpressions: 0 });
  }
}
