import { readQuery } from "@/mcp/db";
import { buildRangeWindow, getLatestSnapshotDate } from "@/mcp/shared";
import type { BiggestChangesResult, MovementRow, ToolDefinition } from "@/mcp/types";
import { validateAnalyticsParams } from "@/mcp/validation";

type Row = {
  query: string;
  clicks_cur: number;
  clicks_prev: number;
  pos_cur: number | null;
  pos_prev: number | null;
  click_change: number;
  page_url: string | null;
};

function toRow(r: Row): MovementRow {
  return {
    query: r.query,
    clicks_change: r.click_change,
    position_from: Number((r.pos_prev ?? 0).toFixed(1)),
    position_to: Number((r.pos_cur ?? 0).toFixed(1)),
    page: r.page_url,
  };
}

export const getBiggestLosersTool: ToolDefinition<"get_biggest_losers"> = {
  name: "get_biggest_losers",
  description: "Biggest losing queries by click change vs previous period.",
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
  handler: async (input, context): Promise<BiggestChangesResult> => {
    if (input.scope !== "project") {
      return { summary: "Project scope required", data: [] };
    }
    const propertyId = context.validatedProperty?.propertyId;
    if (!propertyId) {
      return { summary: "Unauthorized", data: [] };
    }

    const latest = await getLatestSnapshotDate(propertyId);
    if (!latest) {
      return { summary: "No data available", data: [] };
    }
    const w = buildRangeWindow(latest, input.date_range);

    const res = await readQuery<Row>(
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
      WHERE j.click_change < 0
      ORDER BY j.click_change ASC
      LIMIT 25`,
      [propertyId, w.currentStart, w.currentEnd, w.priorStart, w.priorEnd]
    );

    const data = res.rows.map(toRow);
    const summary = data.length ? `${data.length} biggest losing queries` : "No losing queries found";
    return { summary, data };
  },
};

