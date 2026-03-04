import { getPool } from "@/lib/db";
import type { SiteOverviewMetrics } from "@/types/gsc";

export type OverviewParams = {
  teamId: string;
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
};

/**
 * Fetch overview metrics for all team properties from Neon (gsc_property_daily).
 * Used by Project View so sparklines have daily data when user is logged in.
 */
export async function getOverviewMetricsFromDb(
  params: OverviewParams
): Promise<SiteOverviewMetrics[]> {
  const { teamId, startDate, endDate, priorStartDate, priorEndDate } = params;
  const pool = getPool();

  const propsRes = await pool.query<{ id: string; site_url: string }>(
    `SELECT id, site_url FROM properties WHERE team_id = $1 AND active = true ORDER BY site_url`,
    [teamId]
  );
  const properties = propsRes.rows;
  if (properties.length === 0) return [];

  const result: SiteOverviewMetrics[] = [];

  for (const prop of properties) {
    const [currentRes, priorRes, dailyRes] = await Promise.all([
      pool.query<{ clicks: string; impressions: string; position_sum: string }>(
        `SELECT
           COALESCE(SUM(clicks), 0)::text AS clicks,
           COALESCE(SUM(impressions), 0)::text AS impressions,
           COALESCE(SUM(position_sum), 0)::text AS position_sum
         FROM gsc_property_daily
         WHERE property_id = $1 AND team_id = $2 AND date BETWEEN $3::date AND $4::date`,
        [prop.id, teamId, startDate, endDate]
      ),
      pool.query<{ clicks: string; impressions: string; position_sum: string }>(
        `SELECT
           COALESCE(SUM(clicks), 0)::text AS clicks,
           COALESCE(SUM(impressions), 0)::text AS impressions,
           COALESCE(SUM(position_sum), 0)::text AS position_sum
         FROM gsc_property_daily
         WHERE property_id = $1 AND team_id = $2 AND date BETWEEN $3::date AND $4::date`,
        [prop.id, teamId, priorStartDate, priorEndDate]
      ),
      pool.query<{ date: string; clicks: number; impressions: number; position_sum: string }>(
        `SELECT date::text AS date, clicks, impressions, position_sum::text AS position_sum
         FROM gsc_property_daily
         WHERE property_id = $1 AND team_id = $2 AND date BETWEEN $3::date AND $4::date
         ORDER BY date`,
        [prop.id, teamId, startDate, endDate]
      ),
    ]);

    const cur = currentRes.rows[0];
    const prior = priorRes.rows[0];
    const clicks = cur ? Number(cur.clicks) || 0 : 0;
    const impressions = cur ? Number(cur.impressions) || 0 : 0;
    const positionSum = cur ? Number(cur.position_sum) || 0 : 0;
    const position = impressions > 0 ? positionSum / impressions : undefined;
    const priorClicks = prior ? Number(prior.clicks) || 0 : 0;
    const priorImpressions = prior ? Number(prior.impressions) || 0 : 0;
    const priorPositionSum = prior ? Number(prior.position_sum) || 0 : 0;
    const priorPosition = priorImpressions > 0 ? priorPositionSum / priorImpressions : undefined;

    const daily = (dailyRes.rows ?? []).map((r) => {
      const imp = r.impressions ?? 0;
      const posSum = Number(r.position_sum) || 0;
      return {
        date: r.date,
        clicks: r.clicks,
        impressions: imp,
        position: imp > 0 ? posSum / imp : undefined,
      };
    });

    result.push({
      siteUrl: prop.site_url,
      clicks,
      impressions,
      clicksChangePercent:
        priorClicks > 0 ? Math.round(((clicks - priorClicks) / priorClicks) * 100) : 0,
      impressionsChangePercent:
        priorImpressions > 0
          ? Math.round(((impressions - priorImpressions) / priorImpressions) * 100)
          : 0,
      position,
      positionChangePercent:
        position != null && priorPosition != null && priorPosition > 0
          ? Math.round(((position - priorPosition) / priorPosition) * 100)
          : undefined,
      daily,
    });
  }

  return result;
}
