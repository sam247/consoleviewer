import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getSessionUserId } from "@/lib/session";

type Dimension = "query" | "page";

type Row = {
  key: string;
  label: string;
  clicks: number;
  impressions: number;
  clicks_prev: number;
  impressions_prev: number;
  url: string | null;
};

function pct(cur: number, prev: number) {
  if (!prev) return cur ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { propertyId } = await params;
  const resolved = await resolvePropertyForUser(userId, propertyId);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dimension = request.nextUrl.searchParams.get("dimension") as Dimension | null;
  const startDate = request.nextUrl.searchParams.get("startDate");
  const endDate = request.nextUrl.searchParams.get("endDate");
  const priorStartDate = request.nextUrl.searchParams.get("priorStartDate");
  const priorEndDate = request.nextUrl.searchParams.get("priorEndDate");

  if ((dimension !== "query" && dimension !== "page") || !startDate || !endDate || !priorStartDate || !priorEndDate) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const pool = getPool();
  const table = dimension === "query" ? "gsc_query_daily" : "gsc_page_daily";
  const idCol = dimension === "query" ? "query_id" : "page_id";
  const dictJoin =
    dimension === "query"
      ? `JOIN query_dictionary d ON d.id = t.${idCol}`
      : `JOIN page_dictionary d ON d.id = t.${idCol}`;
  const labelExpr = dimension === "query" ? "d.query_text" : "d.page_url";
  const keyExpr = dimension === "query" ? "d.query_text" : "d.page_url";

  const sql = `WITH
  cur AS (
    SELECT ${keyExpr} AS key,
           ${labelExpr} AS label,
           SUM(t.clicks)::float8 AS clicks,
           SUM(t.impressions)::float8 AS impressions
    FROM ${table} t
    ${dictJoin}
    WHERE t.property_id = $1 AND t.date BETWEEN $2::date AND $3::date
    GROUP BY ${keyExpr}, ${labelExpr}
  ),
  prev AS (
    SELECT ${keyExpr} AS key,
           SUM(t.clicks)::float8 AS clicks_prev,
           SUM(t.impressions)::float8 AS impressions_prev
    FROM ${table} t
    ${dictJoin}
    WHERE t.property_id = $1 AND t.date BETWEEN $4::date AND $5::date
    GROUP BY ${keyExpr}
  ),
  joined AS (
    SELECT
      cur.key,
      cur.label,
      cur.clicks,
      cur.impressions,
      COALESCE(prev.clicks_prev, 0)::float8 AS clicks_prev,
      COALESCE(prev.impressions_prev, 0)::float8 AS impressions_prev
    FROM cur
    LEFT JOIN prev ON prev.key = cur.key
  )
  SELECT
    key,
    label,
    clicks,
    impressions,
    clicks_prev,
    impressions_prev,
    ${dimension === "page" ? "label" : "NULL"}::text AS url
  FROM joined
  WHERE clicks + clicks_prev > 0
  ORDER BY (clicks - clicks_prev) DESC
  LIMIT 200`;

  const res = await pool.query<Row>(sql, [resolved.propertyId, startDate, endDate, priorStartDate, priorEndDate]);
  const rows = res.rows;

  const rising = rows
    .filter((r) => r.clicks - r.clicks_prev > 0)
    .sort((a, b) => b.clicks - b.clicks_prev - (a.clicks - a.clicks_prev));
  const dropping = rows
    .filter((r) => r.clicks - r.clicks_prev < 0)
    .sort((a, b) => a.clicks - a.clicks_prev - (b.clicks - b.clicks_prev));

  const payload = {
    rising: {
      count: rising.length,
      rows: rising.slice(0, 50).map((r) => ({
        key: r.key,
        label: r.label,
        clicks: Math.round(r.clicks),
        impressions: Math.round(r.impressions),
        changePercent: pct(r.clicks, r.clicks_prev),
        impressionsChangePercent: pct(r.impressions, r.impressions_prev),
        url: r.url ?? undefined,
      })),
    },
    dropping: {
      count: dropping.length,
      rows: dropping.slice(0, 50).map((r) => ({
        key: r.key,
        label: r.label,
        clicks: Math.round(r.clicks),
        impressions: Math.round(r.impressions),
        changePercent: pct(r.clicks, r.clicks_prev),
        impressionsChangePercent: pct(r.impressions, r.impressions_prev),
        url: r.url ?? undefined,
      })),
    },
  };

  return NextResponse.json(payload);
}
