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

  const pool = getPool();

  const propRes = await pool.query<{ site_url: string; gsc_site_url: string | null }>(
    `SELECT site_url, gsc_site_url FROM properties WHERE id = $1`,
    [resolved.propertyId]
  );
  const site_url = propRes.rows[0]?.site_url ?? null;
  const gsc_site_url = propRes.rows[0]?.gsc_site_url ?? null;

  const snapshotRes = await pool.query<{
    property_id: string;
    date: string;
    clicks: number;
    impressions: number;
    position_sum: number;
    query_count: number;
    top3_count: number;
    top10_count: number;
  }>(
    `SELECT property_id, date, clicks, impressions, position_sum, query_count, top3_count, top10_count
     FROM property_snapshots
     WHERE property_id = $1
     ORDER BY date DESC
     LIMIT 1`,
    [resolved.propertyId]
  );
  const snap = snapshotRes.rows[0];

  const sp = request.nextUrl.searchParams;
  const startDate = sp.get("startDate");
  const endDate = sp.get("endDate");
  const end = endDate || new Date().toISOString().slice(0, 10);
  const start = startDate || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

  const chartRes = await pool.query<{ date: string; clicks: number; impressions: number; position_sum: number }>(
    `SELECT date, clicks, impressions, position_sum
     FROM gsc_property_daily
     WHERE property_id = $1 AND date BETWEEN $2::date AND $3::date
     ORDER BY date`,
    [resolved.propertyId, start, end]
  );
  const chart = chartRes.rows;
  const queryChartRes = await pool.query<{
    date: string;
    query_count: number;
    top10_count: number;
    top3_count: number;
  }>(
    `SELECT date::text AS date, query_count, top10_count, top3_count
     FROM property_snapshots
     WHERE property_id = $1 AND date BETWEEN $2::date AND $3::date
     ORDER BY date`,
    [resolved.propertyId, start, end]
  );
  const query_chart = queryChartRes.rows.map((r) => ({
    date: r.date,
    totalQueries: Number(r.query_count) || 0,
    top10: Number(r.top10_count) || 0,
    top3: Number(r.top3_count) || 0,
  }));

  // If DB has chart data, return it
  if (chart.length > 0) {
    if (!snap) {
      return NextResponse.json({ snapshot: null, chart, query_chart, site_url });
    }
    const impressions = Number(snap.impressions) || 0;
    const clicks = Number(snap.clicks) || 0;
    const positionSum = Number(snap.position_sum) || 0;
    return NextResponse.json({
      snapshot: {
        snapshot_date: snap.date,
        clicks,
        impressions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        avg_position: impressions > 0 ? positionSum / impressions : 0,
        query_count: snap.query_count,
        top3_count: snap.top3_count,
        top10_count: snap.top10_count,
      },
      chart,
      query_chart,
      site_url,
    });
  }

  // No DB data — fall back to live GSC API
  const token = await getAccessTokenForTeam(resolved.teamId);
  if (!token) {
    return NextResponse.json({ snapshot: null, chart: [], query_chart: [], site_url });
  }

  const gscUrl = gsc_site_url || `https://${(site_url ?? "").replace(/^https?:\/\//, "")}`;

  try {
    const [totalRes, dailyRes] = await Promise.all([
      querySearchAnalytics(gscUrl, start, end, [], undefined, token),
      querySearchAnalytics(gscUrl, start, end, ["date"], undefined, token),
    ]);

    const total = totalRes.rows[0];
    const liveChart = (dailyRes.rows ?? [])
      .map((r) => ({
        date: r.keys[0] ?? "",
        clicks: r.clicks,
        impressions: r.impressions,
        position: r.position,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalClicks = total?.clicks ?? 0;
    const totalImpressions = total?.impressions ?? 0;
    const totalPosition = total?.position ?? 0;

    return NextResponse.json({
      snapshot: {
        snapshot_date: end,
        clicks: totalClicks,
        impressions: totalImpressions,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        avg_position: totalPosition,
        query_count: 0,
        top3_count: 0,
        top10_count: 0,
      },
      chart: liveChart,
      query_chart: [],
      site_url,
    });
  } catch {
    return NextResponse.json({ snapshot: null, chart: [], query_chart: [], site_url });
  }
}
