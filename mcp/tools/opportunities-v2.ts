import { readQuery } from "@/mcp/db";
import { buildRangeWindow, getLatestSnapshotDate } from "@/mcp/shared";
import type { OpportunitiesResult, OpportunityRow, ToolDefinition } from "@/mcp/types";
import { validateAnalyticsParams } from "@/mcp/validation";

type Row = {
  query: string;
  position: number;
  impressions: number;
  ctr: number;
  page_url: string | null;
  expected_ctr: number;
};

export const getOpportunitiesTool: ToolDefinition<"get_opportunities"> = {
  name: "get_opportunities",
  description: "Opportunities: queries ranking 5–20 with impressions and underperforming CTR.",
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
  handler: async (input, context): Promise<OpportunitiesResult> => {
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
               SUM(qdly.clicks)::float8 AS clicks,
               SUM(qdly.impressions)::float8 AS impressions,
               (SUM(qdly.position_sum)::float8 / NULLIF(SUM(qdly.impressions)::float8, 0)) AS position
        FROM gsc_query_daily qdly
        JOIN query_dictionary qd ON qd.id = qdly.query_id
        WHERE qdly.property_id = $1 AND qdly.date BETWEEN $2 AND $3
        GROUP BY qd.query_text
      ),
      scored AS (
        SELECT
          query,
          position,
          impressions,
          (clicks / NULLIF(impressions, 0) * 100.0) AS ctr,
          CASE
            WHEN position <= 3 THEN 6.0
            WHEN position <= 5 THEN 3.5
            WHEN position <= 8 THEN 2.2
            WHEN position <= 12 THEN 1.4
            WHEN position <= 15 THEN 1.0
            ELSE 0.8
          END AS expected_ctr
        FROM cur
      ),
      best_page AS (
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
      )
      SELECT s.query,
             s.position,
             s.impressions,
             s.ctr,
             bp.page_url,
             s.expected_ctr
      FROM scored s
      LEFT JOIN best_page bp ON bp.query = s.query
      WHERE s.position BETWEEN 5 AND 20
        AND s.impressions > 500
        AND s.ctr < s.expected_ctr
      ORDER BY (s.impressions * (s.expected_ctr - s.ctr)) DESC
      LIMIT 50`,
      [propertyId, w.currentStart, w.currentEnd]
    );

    const data: OpportunityRow[] = res.rows.map((r) => ({
      query: r.query,
      position: Number(r.position.toFixed(1)),
      impressions: Math.round(r.impressions),
      ctr: Number(r.ctr.toFixed(2)),
      page: r.page_url,
    }));

    const closeToPage1 = data.filter((d) => d.position <= 10).length;
    const summary = data.length
      ? `${closeToPage1 || data.length} queries close to page 1`
      : "No opportunities found";

    return { summary, data };
  },
};
