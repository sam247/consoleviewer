import { readQuery } from "@/mcp/db";
import { buildDefaultWindow, getLatestSnapshotDate, normalizeSiteLabel, resolveMcpProperty } from "@/mcp/shared";
import { validateSiteScopedParams } from "@/mcp/validation";
import type { ToolDefinition, TrafficDropExplanationResult } from "@/mcp/types";

type AggregateRow = {
  clicks: number;
  impressions: number;
  ctr: number;
  avg_position: number;
};

type LossRow = {
  key: string;
  current_clicks: number;
  prior_clicks: number;
  current_impressions: number;
  prior_impressions: number;
  current_position: number;
  prior_position: number;
};

function pctChange(current: number, prior: number): number {
  if (prior <= 0) return current > 0 ? 100 : 0;
  return ((current - prior) / prior) * 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toRounded(value: number): number {
  return Math.round(value * 100) / 100;
}

export const explainTrafficDropTool: ToolDefinition<"explain_traffic_drop"> = {
  name: "explain_traffic_drop",
  description: "Explain likely causes of traffic drops using existing Consoleviewer query/page movement analytics.",
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
  async handler(input, context): Promise<TrafficDropExplanationResult> {
    const property = context.validatedProperty ?? (await resolveMcpProperty(context.userId, input.site));
    if (!property) {
      return {
        site: input.site,
        summary: "Site not found or not accessible for the current user.",
        period: { current_start: "", current_end: "", prior_start: "", prior_end: "" },
        metrics: { clicks_change: 0, impressions_change: 0, ctr_change: 0, position_change: 0 },
        likely_causes: [],
        top_losing_queries: [],
        top_losing_pages: [],
      };
    }

    const latestDate = await getLatestSnapshotDate(property.propertyId);
    if (!latestDate) {
      return {
        site: normalizeSiteLabel(property.siteUrl, property.gscSiteUrl),
        summary: "No snapshot data is available yet for this property.",
        period: { current_start: "", current_end: "", prior_start: "", prior_end: "" },
        metrics: { clicks_change: 0, impressions_change: 0, ctr_change: 0, position_change: 0 },
        likely_causes: [],
        top_losing_queries: [],
        top_losing_pages: [],
      };
    }

    const window = buildDefaultWindow(latestDate);

    const [currentAggRes, priorAggRes, queryLossRes, pageLossRes] = await Promise.all([
      readQuery<AggregateRow>(
        `SELECT COALESCE(SUM(clicks), 0)::int AS clicks,
                COALESCE(SUM(impressions), 0)::int AS impressions,
                CASE WHEN COALESCE(SUM(impressions),0) > 0
                  THEN (COALESCE(SUM(clicks),0)::numeric / SUM(impressions)::numeric) * 100
                  ELSE 0::numeric END AS ctr,
                CASE WHEN COALESCE(SUM(impressions),0) > 0
                  THEN SUM(position_sum) / SUM(impressions)::numeric
                  ELSE 0::numeric END AS avg_position
         FROM gsc_property_daily
         WHERE property_id = $1 AND date BETWEEN $2::date AND $3::date`,
        [property.propertyId, window.currentStart, window.currentEnd]
      ),
      readQuery<AggregateRow>(
        `SELECT COALESCE(SUM(clicks), 0)::int AS clicks,
                COALESCE(SUM(impressions), 0)::int AS impressions,
                CASE WHEN COALESCE(SUM(impressions),0) > 0
                  THEN (COALESCE(SUM(clicks),0)::numeric / SUM(impressions)::numeric) * 100
                  ELSE 0::numeric END AS ctr,
                CASE WHEN COALESCE(SUM(impressions),0) > 0
                  THEN SUM(position_sum) / SUM(impressions)::numeric
                  ELSE 0::numeric END AS avg_position
         FROM gsc_property_daily
         WHERE property_id = $1 AND date BETWEEN $2::date AND $3::date`,
        [property.propertyId, window.priorStart, window.priorEnd]
      ),
      readQuery<LossRow>(
        `WITH cur AS (
           SELECT query_id, SUM(clicks)::int AS clicks, SUM(impressions)::int AS impressions,
                  (SUM(position_sum) / NULLIF(SUM(impressions),0))::numeric AS avg_position
           FROM gsc_query_daily
           WHERE property_id = $1 AND date BETWEEN $2::date AND $3::date
           GROUP BY query_id
         ),
         prev AS (
           SELECT query_id, SUM(clicks)::int AS clicks, SUM(impressions)::int AS impressions,
                  (SUM(position_sum) / NULLIF(SUM(impressions),0))::numeric AS avg_position
           FROM gsc_query_daily
           WHERE property_id = $1 AND date BETWEEN $4::date AND $5::date
           GROUP BY query_id
         )
         SELECT q.query_text AS key,
                COALESCE(cur.clicks, 0)::int AS current_clicks,
                COALESCE(prev.clicks, 0)::int AS prior_clicks,
                COALESCE(cur.impressions, 0)::int AS current_impressions,
                COALESCE(prev.impressions, 0)::int AS prior_impressions,
                COALESCE(cur.avg_position, 0)::numeric AS current_position,
                COALESCE(prev.avg_position, 0)::numeric AS prior_position
         FROM cur
         FULL OUTER JOIN prev ON prev.query_id = cur.query_id
         JOIN query_dictionary q ON q.id = COALESCE(cur.query_id, prev.query_id)
         ORDER BY (COALESCE(cur.clicks,0) - COALESCE(prev.clicks,0)) ASC
         LIMIT 25`,
        [property.propertyId, window.currentStart, window.currentEnd, window.priorStart, window.priorEnd]
      ),
      readQuery<LossRow>(
        `WITH cur AS (
           SELECT page_id, SUM(clicks)::int AS clicks, SUM(impressions)::int AS impressions,
                  (SUM(position_sum) / NULLIF(SUM(impressions),0))::numeric AS avg_position
           FROM gsc_page_daily
           WHERE property_id = $1 AND date BETWEEN $2::date AND $3::date
           GROUP BY page_id
         ),
         prev AS (
           SELECT page_id, SUM(clicks)::int AS clicks, SUM(impressions)::int AS impressions,
                  (SUM(position_sum) / NULLIF(SUM(impressions),0))::numeric AS avg_position
           FROM gsc_page_daily
           WHERE property_id = $1 AND date BETWEEN $4::date AND $5::date
           GROUP BY page_id
         )
         SELECT p.page_url AS key,
                COALESCE(cur.clicks, 0)::int AS current_clicks,
                COALESCE(prev.clicks, 0)::int AS prior_clicks,
                COALESCE(cur.impressions, 0)::int AS current_impressions,
                COALESCE(prev.impressions, 0)::int AS prior_impressions,
                COALESCE(cur.avg_position, 0)::numeric AS current_position,
                COALESCE(prev.avg_position, 0)::numeric AS prior_position
         FROM cur
         FULL OUTER JOIN prev ON prev.page_id = cur.page_id
         JOIN page_dictionary p ON p.id = COALESCE(cur.page_id, prev.page_id)
         ORDER BY (COALESCE(cur.clicks,0) - COALESCE(prev.clicks,0)) ASC
         LIMIT 25`,
        [property.propertyId, window.currentStart, window.currentEnd, window.priorStart, window.priorEnd]
      ),
    ]);

    const current = currentAggRes.rows[0] ?? { clicks: 0, impressions: 0, ctr: 0, avg_position: 0 };
    const prior = priorAggRes.rows[0] ?? { clicks: 0, impressions: 0, ctr: 0, avg_position: 0 };

    const clicksChange = pctChange(Number(current.clicks), Number(prior.clicks));
    const impressionsChange = pctChange(Number(current.impressions), Number(prior.impressions));
    const ctrChange = pctChange(Number(current.ctr), Number(prior.ctr));
    const positionChange = Number(current.avg_position) - Number(prior.avg_position);

    const queryLosses = queryLossRes.rows
      .filter((row) => Number(row.current_clicks) - Number(row.prior_clicks) < 0)
      .map((row) => ({
        query: row.key,
        clicks_change: Number(row.current_clicks) - Number(row.prior_clicks),
        impressions_change: Number(row.current_impressions) - Number(row.prior_impressions),
        position_change: Number(row.current_position) - Number(row.prior_position),
      }))
      .slice(0, 10);

    const pageLosses = pageLossRes.rows
      .filter((row) => Number(row.current_clicks) - Number(row.prior_clicks) < 0)
      .map((row) => ({
        url: row.key,
        clicks_change: Number(row.current_clicks) - Number(row.prior_clicks),
        impressions_change: Number(row.current_impressions) - Number(row.prior_impressions),
        position_change: Number(row.current_position) - Number(row.prior_position),
      }))
      .slice(0, 10);

    const likelyCauses: TrafficDropExplanationResult["likely_causes"] = [];

    if (impressionsChange < -5) {
      likelyCauses.push({
        type: "demand_or_visibility_drop",
        impact: toRounded(impressionsChange),
        confidence: toRounded(clamp(Math.abs(impressionsChange) / 30, 0.2, 0.95)),
        detail: "Impressions declined meaningfully versus the prior window.",
      });
    }
    if (positionChange > 0.25) {
      likelyCauses.push({
        type: "ranking_decline",
        impact: toRounded(positionChange),
        confidence: toRounded(clamp(positionChange / 4, 0.2, 0.95)),
        detail: "Average ranking position worsened in the current period.",
      });
    }
    if (ctrChange < -5) {
      likelyCauses.push({
        type: "ctr_decline",
        impact: toRounded(ctrChange),
        confidence: toRounded(clamp(Math.abs(ctrChange) / 25, 0.2, 0.95)),
        detail: "CTR dropped relative to prior performance.",
      });
    }
    if (queryLosses.length > 0) {
      likelyCauses.push({
        type: "query_level_losses",
        impact: queryLosses.reduce((acc, row) => acc + row.clicks_change, 0),
        confidence: 0.75,
        detail: "A concentrated set of queries drove a large share of click loss.",
      });
    }

    const summary =
      clicksChange < 0
        ? `Clicks fell by ${toRounded(Math.abs(clicksChange))}% versus the prior window, driven by query/page losses.`
        : "No material traffic drop detected in the current window compared with the prior period.";

    return {
      site: normalizeSiteLabel(property.siteUrl, property.gscSiteUrl),
      summary,
      period: {
        current_start: window.currentStart,
        current_end: window.currentEnd,
        prior_start: window.priorStart,
        prior_end: window.priorEnd,
      },
      metrics: {
        clicks_change: toRounded(clicksChange),
        impressions_change: toRounded(impressionsChange),
        ctr_change: toRounded(ctrChange),
        position_change: toRounded(positionChange),
      },
      likely_causes: likelyCauses,
      top_losing_queries: queryLosses,
      top_losing_pages: pageLosses,
    };
  },
};
