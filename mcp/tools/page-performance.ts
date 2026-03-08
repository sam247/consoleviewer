import { readQuery } from "@/mcp/db";
import { buildDefaultWindow, getLatestSnapshotDate, resolveMcpProperty } from "@/mcp/shared";
import { validateSiteScopedParams } from "@/mcp/validation";
import type { PagePerformanceRow, ToolDefinition } from "@/mcp/types";

export const getPagePerformanceTool: ToolDefinition<"get_page_performance"> = {
  name: "get_page_performance",
  description: "Return page-level SEO performance using existing page aggregate analytics.",
  inputSchema: {
    type: "object",
    properties: {
      site: { type: "string", description: "Consoleviewer property UUID or encoded property ID" },
      startDate: { type: "string", description: "Optional YYYY-MM-DD (validated, ignored in v1)" },
      endDate: { type: "string", description: "Optional YYYY-MM-DD (validated, ignored in v1)" },
    },
    required: ["site"],
    additionalProperties: false,
  },
  validate: validateSiteScopedParams,
  async handler(input, context): Promise<PagePerformanceRow[]> {
    const property = context.validatedProperty ?? (await resolveMcpProperty(context.userId, input.site));
    if (!property) return [];

    const latestDate = await getLatestSnapshotDate(property.propertyId);
    if (!latestDate) return [];

    const window = buildDefaultWindow(latestDate);

    const res = await readQuery<{
      url: string;
      clicks: number;
      impressions: number;
      avg_position: number;
      prior_clicks: number;
      prior_impressions: number;
      prior_avg_position: number;
    }>(
      `WITH current_window AS (
         SELECT g.page_id, SUM(g.clicks)::int AS clicks, SUM(g.impressions)::int AS impressions,
                (SUM(g.position_sum) / NULLIF(SUM(g.impressions), 0))::numeric AS avg_position
         FROM gsc_page_daily g
         WHERE g.property_id = $1 AND g.date BETWEEN $2::date AND $3::date
         GROUP BY g.page_id
       ),
       prior_window AS (
         SELECT g.page_id, SUM(g.clicks)::int AS clicks, SUM(g.impressions)::int AS impressions,
                (SUM(g.position_sum) / NULLIF(SUM(g.impressions), 0))::numeric AS avg_position
         FROM gsc_page_daily g
         WHERE g.property_id = $1 AND g.date BETWEEN $4::date AND $5::date
         GROUP BY g.page_id
       )
       SELECT p.page_url AS url,
              COALESCE(c.clicks, 0)::int AS clicks,
              COALESCE(c.impressions, 0)::int AS impressions,
              COALESCE(c.avg_position, 0)::numeric AS avg_position,
              COALESCE(pr.clicks, 0)::int AS prior_clicks,
              COALESCE(pr.impressions, 0)::int AS prior_impressions,
              COALESCE(pr.avg_position, 0)::numeric AS prior_avg_position
       FROM current_window c
       FULL OUTER JOIN prior_window pr ON pr.page_id = c.page_id
       JOIN page_dictionary p ON p.id = COALESCE(c.page_id, pr.page_id)
       ORDER BY COALESCE(c.clicks, 0) DESC
       LIMIT 100`,
      [property.propertyId, window.currentStart, window.currentEnd, window.priorStart, window.priorEnd]
    );

    return res.rows.map((row) => {
      const clicks = Number(row.clicks) || 0;
      const impressions = Number(row.impressions) || 0;
      const position = Number(row.avg_position) || 0;
      const priorPosition = Number(row.prior_avg_position) || 0;
      return {
        url: row.url,
        clicks,
        impressions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        position,
        change: priorPosition > 0 ? priorPosition - position : 0,
      };
    });
  },
};
