import { readQuery } from "@/mcp/db";
import { getLatestSnapshotDate, resolveMcpProperty } from "@/mcp/shared";
import { validateSiteScopedParams } from "@/mcp/validation";
import type { RecentChangeItem, RecentChangesResult, ToolDefinition } from "@/mcp/types";

const MIN_DELTA_THRESHOLD = 0.1;

export const getRecentChangesTool: ToolDefinition<"get_recent_changes"> = {
  name: "get_recent_changes",
  description: "Detect recent SEO movement (gains/losses/new/dropped rankings) from existing movement analytics.",
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
  async handler(input, context): Promise<RecentChangesResult> {
    const property = context.validatedProperty ?? (await resolveMcpProperty(context.userId, input.site));
    if (!property) return { gains: [], losses: [], new_rankings: [], dropped_rankings: [] };

    const latestDate = await getLatestSnapshotDate(property.propertyId);
    if (!latestDate) return { gains: [], losses: [], new_rankings: [], dropped_rankings: [] };

    const priorTargetDate = new Date(`${latestDate}T00:00:00.000Z`);
    priorTargetDate.setUTCDate(priorTargetDate.getUTCDate() - 7);
    const priorCandidate = priorTargetDate.toISOString().slice(0, 10);

    const rowsRes = await readQuery<{
      query_text: string;
      trend: string | null;
      delta_7d: number | null;
      current_clicks: number | null;
      current_impressions: number | null;
      current_position: number | null;
      previous_clicks: number | null;
      previous_impressions: number | null;
      previous_position: number | null;
    }>(
      `WITH prior_day AS (
         SELECT COALESCE((SELECT MAX(date)::text FROM gsc_query_daily WHERE property_id = $1 AND date <= $2::date), $2::text) AS d
       ),
       cur AS (
         SELECT q.id AS query_id, q.query_text, SUM(g.clicks)::int AS clicks, SUM(g.impressions)::int AS impressions,
                (SUM(g.position_sum) / NULLIF(SUM(g.impressions), 0))::numeric AS avg_position
         FROM gsc_query_daily g
         JOIN query_dictionary q ON q.id = g.query_id
         WHERE g.property_id = $1 AND g.date = $3::date
         GROUP BY q.id, q.query_text
       ),
       prev AS (
         SELECT q.id AS query_id, q.query_text, SUM(g.clicks)::int AS clicks, SUM(g.impressions)::int AS impressions,
                (SUM(g.position_sum) / NULLIF(SUM(g.impressions), 0))::numeric AS avg_position
         FROM gsc_query_daily g
         JOIN query_dictionary q ON q.id = g.query_id
         WHERE g.property_id = $1 AND g.date = (SELECT d::date FROM prior_day)
         GROUP BY q.id, q.query_text
       ),
       movement AS (
         SELECT q.query_id, q.query_text, r.trend, r.delta_7d
         FROM ranking_movements r
         JOIN query_dictionary q ON q.id = r.query_id
         WHERE r.property_id = $1 AND r.date = $3::date
       ),
       joined AS (
         SELECT COALESCE(m.query_text, cur.query_text, prev.query_text) AS query_text,
                m.trend, m.delta_7d,
                cur.clicks AS current_clicks, cur.impressions AS current_impressions, cur.avg_position AS current_position,
                prev.clicks AS previous_clicks, prev.impressions AS previous_impressions, prev.avg_position AS previous_position
         FROM cur
         FULL OUTER JOIN prev ON prev.query_id = cur.query_id
         FULL OUTER JOIN movement m ON m.query_id = COALESCE(cur.query_id, prev.query_id)
       )
       SELECT * FROM joined
       ORDER BY ABS(COALESCE(delta_7d, 0)) DESC NULLS LAST
       LIMIT 150`,
      [property.propertyId, priorCandidate, latestDate]
    );

    const gains: RecentChangeItem[] = [];
    const losses: RecentChangeItem[] = [];
    const newRankings: RecentChangeItem[] = [];
    const droppedRankings: RecentChangeItem[] = [];

    for (const row of rowsRes.rows) {
      const previousImpressions = Number(row.previous_impressions ?? 0);
      const currentImpressions = Number(row.current_impressions ?? 0);
      const previousClicks = Number(row.previous_clicks ?? 0);
      const currentClicks = Number(row.current_clicks ?? 0);
      const previousPosition = Number(row.previous_position ?? 0);
      const currentPosition = Number(row.current_position ?? 0);

      const payload: RecentChangeItem = {
        query: row.query_text,
        previous_position: previousPosition,
        current_position: currentPosition,
        impressions_change: currentImpressions - previousImpressions,
        clicks_change: currentClicks - previousClicks,
      };

      const hasPrevious = previousImpressions > 0;
      const hasCurrent = currentImpressions > 0;

      if (!hasPrevious && hasCurrent) {
        newRankings.push(payload);
        continue;
      }
      if (hasPrevious && !hasCurrent) {
        droppedRankings.push(payload);
        continue;
      }

      const trend = (row.trend ?? "").toLowerCase();
      const delta = Number(row.delta_7d ?? 0);
      if (Math.abs(delta) < MIN_DELTA_THRESHOLD) continue;

      if (trend === "up") gains.push(payload);
      else if (trend === "down") losses.push(payload);
      else if (currentPosition > 0 && previousPosition > 0) {
        if (currentPosition < previousPosition) gains.push(payload);
        if (currentPosition > previousPosition) losses.push(payload);
      }
    }

    return {
      gains: gains.slice(0, 25),
      losses: losses.slice(0, 25),
      new_rankings: newRankings.slice(0, 25),
      dropped_rankings: droppedRankings.slice(0, 25),
    };
  },
};
