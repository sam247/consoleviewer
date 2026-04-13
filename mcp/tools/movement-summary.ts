import { readQuery } from "@/mcp/db";
import { buildRangeWindow, getLatestSnapshotDate } from "@/mcp/shared";
import type { MovementSummaryResult, MovementRow, ToolDefinition } from "@/mcp/types";
import { validateAnalyticsParams } from "@/mcp/validation";

type QueryAggRow = {
  query: string;
  clicks_cur: number;
  clicks_prev: number;
  pos_cur: number | null;
  pos_prev: number | null;
  click_change: number;
  page_url: string | null;
};

type TotalsRow = {
  clicks_cur: number;
  clicks_prev: number;
};

function pctChange(cur: number, prev: number) {
  if (!prev) return cur ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

function toMovementRow(r: QueryAggRow): MovementRow {
  return {
    query: r.query,
    clicks_change: r.click_change,
    position_from: Number((r.pos_prev ?? 0).toFixed(1)),
    position_to: Number((r.pos_cur ?? 0).toFixed(1)),
    page: r.page_url,
  };
}

export const getMovementSummaryTool: ToolDefinition<"get_movement_summary"> = {
  name: "get_movement_summary",
  description: "Summarize query movement vs previous period with top gains/declines.",
  inputSchema: {
    type: "object",
    properties: {
      scope: { type: "string", enum: ["project", "all_projects"] },
      project_id: { type: "string" },
      date_range: { type: "string", enum: ["last_7_days"] },
      compare: { type: "string", enum: ["previous_period"] },
    },
    required: ["scope", "date_range", "compare"],
    additionalProperties: false,
  },
  validate: validateAnalyticsParams,
  handler: async (input, context): Promise<MovementSummaryResult> => {
    if (input.scope !== "project") {
      return { summary: "Project scope required", declines: [], gains: [] };
    }
    const propertyId = context.validatedProperty?.propertyId;
    if (!propertyId) {
      return { summary: "Unauthorized", declines: [], gains: [] };
    }

    const latest = await getLatestSnapshotDate(propertyId);
    if (!latest) {
      return { summary: "No data available", declines: [], gains: [] };
    }

    const w = buildRangeWindow(latest, input.date_range);

    const totals = await readQuery<TotalsRow>(
      `SELECT
         SUM(CASE WHEN date BETWEEN $2 AND $3 THEN clicks ELSE 0 END)::float8 AS clicks_cur,
         SUM(CASE WHEN date BETWEEN $4 AND $5 THEN clicks ELSE 0 END)::float8 AS clicks_prev
       FROM gsc_property_daily
       WHERE property_id = $1 AND date BETWEEN $4 AND $3`,
      [propertyId, w.currentStart, w.currentEnd, w.priorStart, w.priorEnd]
    );
    const totalCur = totals.rows[0]?.clicks_cur ?? 0;
    const totalPrev = totals.rows[0]?.clicks_prev ?? 0;

    const res = await readQuery<QueryAggRow>(
      `WITH
      cur AS (
        SELECT qd.query_text AS query,
               SUM(qdly.clicks)::float8 AS clicks_cur,
               SUM(qdly.impressions)::float8 AS impr_cur,
               (SUM(qdly.position_sum)::float8 / NULLIF(SUM(qdly.impressions)::float8, 0)) AS pos_cur
        FROM gsc_query_daily qdly
        JOIN query_dictionary qd ON qd.id = qdly.query_id
        WHERE qdly.property_id = $1 AND qdly.date BETWEEN $2 AND $3
        GROUP BY qd.query_text
      ),
      prev AS (
        SELECT qd.query_text AS query,
               SUM(qdly.clicks)::float8 AS clicks_prev,
               SUM(qdly.impressions)::float8 AS impr_prev,
               (SUM(qdly.position_sum)::float8 / NULLIF(SUM(qdly.impressions)::float8, 0)) AS pos_prev
        FROM gsc_query_daily qdly
        JOIN query_dictionary qd ON qd.id = qdly.query_id
        WHERE qdly.property_id = $1 AND qdly.date BETWEEN $4 AND $5
        GROUP BY qd.query_text
      ),
      best_page_cur AS (
        SELECT t.query, t.page_url
        FROM (
          SELECT qd.query_text AS query,
                 pd.page_url AS page_url,
                 SUM(r.clicks)::float8 AS clicks,
                 ROW_NUMBER() OVER (PARTITION BY qd.query_text ORDER BY SUM(r.clicks) DESC) AS rn
          FROM gsc_raw r
          JOIN query_dictionary qd ON qd.query_hash = r.query_hash
          JOIN page_dictionary pd ON pd.page_hash = r.page_hash
          WHERE r.property_id = $1 AND r.date BETWEEN $2 AND $3
          GROUP BY qd.query_text, pd.page_url
        ) t
        WHERE t.rn = 1
      ),
      best_page_prev AS (
        SELECT t.query, t.page_url
        FROM (
          SELECT qd.query_text AS query,
                 pd.page_url AS page_url,
                 SUM(r.clicks)::float8 AS clicks,
                 ROW_NUMBER() OVER (PARTITION BY qd.query_text ORDER BY SUM(r.clicks) DESC) AS rn
          FROM gsc_raw r
          JOIN query_dictionary qd ON qd.query_hash = r.query_hash
          JOIN page_dictionary pd ON pd.page_hash = r.page_hash
          WHERE r.property_id = $1 AND r.date BETWEEN $4 AND $5
          GROUP BY qd.query_text, pd.page_url
        ) t
        WHERE t.rn = 1
      ),
      joined AS (
        SELECT COALESCE(cur.query, prev.query) AS query,
               COALESCE(cur.clicks_cur, 0)::float8 AS clicks_cur,
               COALESCE(prev.clicks_prev, 0)::float8 AS clicks_prev,
               cur.pos_cur AS pos_cur,
               prev.pos_prev AS pos_prev,
               (COALESCE(cur.clicks_cur, 0) - COALESCE(prev.clicks_prev, 0))::float8 AS click_change
        FROM cur
        FULL OUTER JOIN prev USING (query)
      )
      SELECT j.query,
             j.clicks_cur,
             j.clicks_prev,
             j.pos_cur,
             j.pos_prev,
             j.click_change,
             COALESCE(bc.page_url, bp.page_url) AS page_url
      FROM joined j
      LEFT JOIN best_page_cur bc ON bc.query = j.query
      LEFT JOIN best_page_prev bp ON bp.query = j.query
      WHERE (j.clicks_cur + j.clicks_prev) > 0
      ORDER BY ABS(j.click_change) DESC
      LIMIT 300`,
      [propertyId, w.currentStart, w.currentEnd, w.priorStart, w.priorEnd]
    );

    const rows = res.rows;
    const overallPct = Math.round(pctChange(totalCur, totalPrev));

    const declines = rows
      .filter((r) => r.click_change < 0)
      .sort((a, b) => a.click_change - b.click_change)
      .slice(0, 8)
      .map(toMovementRow);

    const gains = rows
      .filter((r) => r.click_change > 0)
      .sort((a, b) => b.click_change - a.click_change)
      .slice(0, 8)
      .map(toMovementRow);

    const topDecline = declines[0];
    const driver = topDecline?.query ? ` driven by "${topDecline.query}"` : "";
    const summary = overallPct < 0 ? `Traffic down ${Math.abs(overallPct)}%${driver}` : overallPct > 0 ? `Traffic up ${overallPct}%` : "Traffic stable";

    return { summary, declines, gains };
  },
};
