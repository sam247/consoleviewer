import { readQuery } from "@/mcp/db";
import { buildRangeWindow, getLatestSnapshotDate } from "@/mcp/shared";
import type { NotFoundPagesResult, NotFoundPageRow, ToolDefinition } from "@/mcp/types";
import { validateAnalyticsParams } from "@/mcp/validation";

type Row = {
  page: string;
  clicks_cur: number;
  impressions_cur: number;
  pos_cur: number | null;
  clicks_prev: number;
  impressions_prev: number;
  pos_prev: number | null;
};

function ctr(clicks: number, impressions: number) {
  if (!impressions) return 0;
  return (clicks / impressions) * 100;
}

export const get404PagesTool: ToolDefinition<"get_404_pages"> = {
  name: "get_404_pages",
  description: "List likely 404 / not-found pages (heuristic based on URL patterns) with clicks/impressions and deltas.",
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
  handler: async (input, context): Promise<NotFoundPagesResult> => {
    if (input.scope !== "project") {
      return { summary: "Project scope required", data: [] };
    }
    const propertyId = context.validatedProperty?.propertyId;
    if (!propertyId) return { summary: "Unauthorized", data: [] };

    const latest = await getLatestSnapshotDate(propertyId);
    if (!latest) return { summary: "No data available", data: [] };

    const w = buildRangeWindow(latest, input.date_range);

    const res = await readQuery<Row>(
      `WITH
      cur AS (
        SELECT p.page_url AS page,
               SUM(g.clicks)::float8 AS clicks_cur,
               SUM(g.impressions)::float8 AS impressions_cur,
               (SUM(g.position_sum)::float8 / NULLIF(SUM(g.impressions)::float8, 0)) AS pos_cur
        FROM gsc_page_daily g
        JOIN page_dictionary p ON p.id = g.page_id
        WHERE g.property_id = $1 AND g.date BETWEEN $2 AND $3
        GROUP BY p.page_url
      ),
      prev AS (
        SELECT p.page_url AS page,
               SUM(g.clicks)::float8 AS clicks_prev,
               SUM(g.impressions)::float8 AS impressions_prev,
               (SUM(g.position_sum)::float8 / NULLIF(SUM(g.impressions)::float8, 0)) AS pos_prev
        FROM gsc_page_daily g
        JOIN page_dictionary p ON p.id = g.page_id
        WHERE g.property_id = $1 AND g.date BETWEEN $4 AND $5
        GROUP BY p.page_url
      ),
      joined AS (
        SELECT
          COALESCE(cur.page, prev.page) AS page,
          COALESCE(cur.clicks_cur, 0)::float8 AS clicks_cur,
          COALESCE(cur.impressions_cur, 0)::float8 AS impressions_cur,
          cur.pos_cur AS pos_cur,
          COALESCE(prev.clicks_prev, 0)::float8 AS clicks_prev,
          COALESCE(prev.impressions_prev, 0)::float8 AS impressions_prev,
          prev.pos_prev AS pos_prev
        FROM cur
        FULL OUTER JOIN prev USING (page)
      )
      SELECT page, clicks_cur, impressions_cur, pos_cur, clicks_prev, impressions_prev, pos_prev
      FROM joined
      WHERE (
        LOWER(page) LIKE '%404%'
        OR LOWER(page) LIKE '%not-found%'
        OR LOWER(page) LIKE '%page-not-found%'
        OR LOWER(page) LIKE '%/notfound%'
      )
      ORDER BY (clicks_cur + clicks_prev) DESC, (impressions_cur + impressions_prev) DESC
      LIMIT 2000`,
      [propertyId, w.currentStart, w.currentEnd, w.priorStart, w.priorEnd]
    );

    const rows: NotFoundPageRow[] = res.rows.map((r) => {
      const clicksChange = r.clicks_cur - r.clicks_prev;
      const impressionsChange = r.impressions_cur - r.impressions_prev;
      return {
        page: r.page,
        clicks: Math.round(r.clicks_cur),
        impressions: Math.round(r.impressions_cur),
        ctr: Number(ctr(r.clicks_cur, r.impressions_cur).toFixed(2)),
        position: Number(((r.pos_cur ?? 0) as number).toFixed(1)),
        clicks_change: Math.round(clicksChange),
        impressions_change: Math.round(impressionsChange),
      };
    });

    const summary = rows.length ? `${rows.length} likely 404 pages found` : "No likely 404 pages found";
    return { summary, data: rows };
  },
};

