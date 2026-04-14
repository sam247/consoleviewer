import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getPool } from "@/lib/db";

type Dimension = "query" | "page" | "keyword";

function parseIntParam(value: string | null, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { propertyId: param } = await params;
  const resolved = await resolvePropertyForUser(userId, param);
  if (!resolved) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const startDate = request.nextUrl.searchParams.get("startDate");
  const endDate = request.nextUrl.searchParams.get("endDate");
  if (!startDate?.trim() || !endDate?.trim()) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  const priorStartDate = request.nextUrl.searchParams.get("priorStartDate");
  const priorEndDate = request.nextUrl.searchParams.get("priorEndDate");
  const hasPrior = Boolean(priorStartDate?.trim() && priorEndDate?.trim());

  const rawDim = (request.nextUrl.searchParams.get("dimension") || "query").toLowerCase();
  const dimension: Dimension = rawDim === "page" ? "page" : rawDim === "keyword" ? "keyword" : "query";

  const limit = clamp(parseIntParam(request.nextUrl.searchParams.get("limit"), 1000), 1, 5000);
  const offset = parseIntParam(request.nextUrl.searchParams.get("offset"), 0);

  const cfg =
    dimension === "page"
      ? {
          dailyTable: "gsc_page_daily",
          idCol: "page_id",
          dictTable: "page_dictionary",
          dictIdCol: "id",
          textCol: "page_url",
        }
      : {
          dailyTable: "gsc_query_daily",
          idCol: "query_id",
          dictTable: "query_dictionary",
          dictIdCol: "id",
          textCol: "query_text",
        };

  const pool = getPool();

  const sql = hasPrior
    ? `WITH
      cur AS (
        SELECT
          g.${cfg.idCol} AS dim_id,
          d.${cfg.textCol} AS key,
          SUM(g.clicks)::float8 AS clicks,
          SUM(g.impressions)::float8 AS impressions,
          (SUM(g.position_sum)::float8 / NULLIF(SUM(g.impressions)::float8, 0)) AS position
        FROM ${cfg.dailyTable} g
        JOIN ${cfg.dictTable} d ON d.${cfg.dictIdCol} = g.${cfg.idCol}
        WHERE g.property_id = $1 AND g.date BETWEEN $2::date AND $3::date
        GROUP BY g.${cfg.idCol}, d.${cfg.textCol}
      ),
      prev AS (
        SELECT
          g.${cfg.idCol} AS dim_id,
          d.${cfg.textCol} AS key,
          SUM(g.clicks)::float8 AS clicks_prev,
          SUM(g.impressions)::float8 AS impressions_prev,
          (SUM(g.position_sum)::float8 / NULLIF(SUM(g.impressions)::float8, 0)) AS position_prev
        FROM ${cfg.dailyTable} g
        JOIN ${cfg.dictTable} d ON d.${cfg.dictIdCol} = g.${cfg.idCol}
        WHERE g.property_id = $1 AND g.date BETWEEN $4::date AND $5::date
        GROUP BY g.${cfg.idCol}, d.${cfg.textCol}
      )
      SELECT
        COALESCE(cur.key, prev.key) AS key,
        COALESCE(cur.clicks, 0)::float8 AS clicks,
        COALESCE(cur.impressions, 0)::float8 AS impressions,
        (COALESCE(cur.clicks, 0) / NULLIF(COALESCE(cur.impressions, 0), 0) * 100.0)::float8 AS ctr,
        cur.position AS position,
        COALESCE(prev.clicks_prev, 0)::float8 AS clicks_prev,
        COALESCE(prev.impressions_prev, 0)::float8 AS impressions_prev,
        (COALESCE(prev.clicks_prev, 0) / NULLIF(COALESCE(prev.impressions_prev, 0), 0) * 100.0)::float8 AS ctr_prev,
        prev.position_prev AS position_prev,
        (COALESCE(cur.clicks, 0) - COALESCE(prev.clicks_prev, 0))::float8 AS clicks_change,
        (COALESCE(cur.impressions, 0) - COALESCE(prev.impressions_prev, 0))::float8 AS impressions_change,
        ((COALESCE(cur.clicks, 0) / NULLIF(COALESCE(cur.impressions, 0), 0) * 100.0) - (COALESCE(prev.clicks_prev, 0) / NULLIF(COALESCE(prev.impressions_prev, 0), 0) * 100.0))::float8 AS ctr_change,
        (cur.position - prev.position_prev)::float8 AS position_change,
        CASE
          WHEN COALESCE(prev.clicks_prev, 0) > 0
            THEN ((COALESCE(cur.clicks, 0) - COALESCE(prev.clicks_prev, 0)) / COALESCE(prev.clicks_prev, 0) * 100.0)::float8
          ELSE NULL
        END AS clicks_change_percent
      FROM cur
      FULL OUTER JOIN prev USING (dim_id)
      WHERE COALESCE(cur.key, prev.key) IS NOT NULL
      ORDER BY clicks DESC
      LIMIT $6 OFFSET $7`
    : `SELECT
        d.${cfg.textCol} AS key,
        SUM(g.clicks)::float8 AS clicks,
        SUM(g.impressions)::float8 AS impressions,
        (SUM(g.clicks)::float8 / NULLIF(SUM(g.impressions)::float8, 0) * 100.0)::float8 AS ctr,
        (SUM(g.position_sum)::float8 / NULLIF(SUM(g.impressions)::float8, 0)) AS position,
        NULL::float8 AS clicks_prev,
        NULL::float8 AS impressions_prev,
        NULL::float8 AS ctr_prev,
        NULL::float8 AS position_prev,
        NULL::float8 AS clicks_change,
        NULL::float8 AS impressions_change,
        NULL::float8 AS ctr_change,
        NULL::float8 AS position_change,
        NULL::float8 AS clicks_change_percent
      FROM ${cfg.dailyTable} g
      JOIN ${cfg.dictTable} d ON d.${cfg.dictIdCol} = g.${cfg.idCol}
      WHERE g.property_id = $1 AND g.date BETWEEN $2::date AND $3::date
      GROUP BY g.${cfg.idCol}, d.${cfg.textCol}
      ORDER BY SUM(g.clicks) DESC
      LIMIT $4 OFFSET $5`;

  const values = hasPrior
    ? [resolved.propertyId, startDate, endDate, priorStartDate, priorEndDate, limit, offset]
    : [resolved.propertyId, startDate, endDate, limit, offset];

  const res = await pool.query(sql, values);
  return NextResponse.json({ rows: res.rows, limit, offset, hasPrior });
}

