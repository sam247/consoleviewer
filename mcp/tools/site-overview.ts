import { readQuery } from "@/mcp/db";
import { buildDefaultWindow, getLatestSnapshotDate, normalizeSiteLabel, resolveMcpProperty } from "@/mcp/shared";
import { validateSiteScopedParams } from "@/mcp/validation";
import type { SiteOverviewItem, SiteOverviewResult, ToolDefinition } from "@/mcp/types";

function weightByPosition(pos: number): number {
  if (pos <= 3) return 1;
  if (pos <= 10) return 0.5;
  if (pos <= 20) return 0.2;
  return 0.05;
}

export const getSiteOverviewTool: ToolDefinition<"get_site_overview"> = {
  name: "get_site_overview",
  description: "Return high-level SEO analytics for a site from the existing Consoleviewer analytics engine.",
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
  async handler(input, context): Promise<SiteOverviewResult> {
    const property = context.validatedProperty ?? (await resolveMcpProperty(context.userId, input.site));
    if (!property) {
      return {
        site: input.site,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        avg_position: 0,
        visibility_score: 0,
        top_queries: [],
        top_pages: [],
      };
    }

    const latestDate = await getLatestSnapshotDate(property.propertyId);
    if (!latestDate) {
      return {
        site: normalizeSiteLabel(property.siteUrl, property.gscSiteUrl),
        clicks: 0,
        impressions: 0,
        ctr: 0,
        avg_position: 0,
        visibility_score: 0,
        top_queries: [],
        top_pages: [],
      };
    }

    const window = buildDefaultWindow(latestDate);

    const [snapshotRes, scoreRes, topQueriesRes, topPagesRes] = await Promise.all([
      readQuery<{ clicks: number; impressions: number; position_sum: number }>(
        `SELECT clicks, impressions, position_sum
         FROM property_snapshots
         WHERE property_id = $1 AND date = $2::date
         LIMIT 1`,
        [property.propertyId, latestDate]
      ),
      readQuery<{ visibility_score: number }>(
        `SELECT visibility_score
         FROM property_scores
         WHERE property_id = $1 AND date = $2::date
         LIMIT 1`,
        [property.propertyId, latestDate]
      ),
      readQuery<{ query: string; clicks: number; impressions: number; avg_position: number }>(
        `SELECT
           q.query_text AS query,
           SUM(g.clicks)::int AS clicks,
           SUM(g.impressions)::int AS impressions,
           (SUM(g.position_sum) / NULLIF(SUM(g.impressions), 0))::numeric AS avg_position
         FROM gsc_query_daily g
         JOIN query_dictionary q ON q.id = g.query_id
         WHERE g.property_id = $1
           AND g.date BETWEEN $2::date AND $3::date
         GROUP BY g.query_id, q.query_text
         ORDER BY SUM(g.clicks) DESC
         LIMIT 10`,
        [property.propertyId, window.currentStart, window.currentEnd]
      ),
      readQuery<{ url: string; clicks: number; impressions: number; avg_position: number }>(
        `SELECT
           p.page_url AS url,
           SUM(g.clicks)::int AS clicks,
           SUM(g.impressions)::int AS impressions,
           (SUM(g.position_sum) / NULLIF(SUM(g.impressions), 0))::numeric AS avg_position
         FROM gsc_page_daily g
         JOIN page_dictionary p ON p.id = g.page_id
         WHERE g.property_id = $1
           AND g.date BETWEEN $2::date AND $3::date
         GROUP BY g.page_id, p.page_url
         ORDER BY SUM(g.clicks) DESC
         LIMIT 10`,
        [property.propertyId, window.currentStart, window.currentEnd]
      ),
    ]);

    const snapshot = snapshotRes.rows[0];
    const clicks = Number(snapshot?.clicks ?? 0);
    const impressions = Number(snapshot?.impressions ?? 0);
    const positionSum = Number(snapshot?.position_sum ?? 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const avgPosition = impressions > 0 ? positionSum / impressions : 0;

    const topQueries: SiteOverviewItem[] = topQueriesRes.rows.map((row) => {
      const rowClicks = Number(row.clicks) || 0;
      const rowImpressions = Number(row.impressions) || 0;
      return {
        query: row.query,
        clicks: rowClicks,
        impressions: rowImpressions,
        ctr: rowImpressions > 0 ? (rowClicks / rowImpressions) * 100 : 0,
        position: Number(row.avg_position) || 0,
      };
    });

    const topPages: SiteOverviewItem[] = topPagesRes.rows.map((row) => {
      const rowClicks = Number(row.clicks) || 0;
      const rowImpressions = Number(row.impressions) || 0;
      return {
        url: row.url,
        clicks: rowClicks,
        impressions: rowImpressions,
        ctr: rowImpressions > 0 ? (rowClicks / rowImpressions) * 100 : 0,
        position: Number(row.avg_position) || 0,
      };
    });

    let visibilityScore = Number(scoreRes.rows[0]?.visibility_score ?? 0);

    if (visibilityScore === 0 && topQueries.length > 0) {
      const impressionsInQueries = topQueries.reduce((acc, row) => acc + row.impressions, 0);
      const weightedSum = topQueries.reduce((acc, row) => acc + row.impressions * weightByPosition(row.position), 0);
      visibilityScore = impressionsInQueries > 0 ? Math.round((weightedSum / impressionsInQueries) * 1000) / 10 : 0;
    }

    return {
      site: normalizeSiteLabel(property.siteUrl, property.gscSiteUrl),
      clicks,
      impressions,
      ctr,
      avg_position: avgPosition,
      visibility_score: visibilityScore,
      top_queries: topQueries,
      top_pages: topPages,
    };
  },
};
