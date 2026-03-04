import { getPool } from "@/lib/db";
import { getAccessTokenForTeam } from "@/lib/gsc-tokens";
import { querySearchAnalytics } from "@/lib/gsc";
import type { SiteOverviewMetrics } from "@/types/gsc";

export type OverviewParams = {
  teamId: string;
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
};

/**
 * Fetch overview metrics for all team properties.
 * Tries Neon DB first; when no daily data exists, falls back to live GSC API
 * using the team's stored refresh token.
 */
export async function getOverviewMetricsFromDb(
  params: OverviewParams
): Promise<SiteOverviewMetrics[]> {
  const { teamId, startDate, endDate, priorStartDate, priorEndDate } = params;
  const pool = getPool();

  const propsRes = await pool.query<{ id: string; site_url: string; gsc_site_url: string | null }>(
    `SELECT id, site_url, gsc_site_url FROM properties WHERE team_id = $1 AND active = true ORDER BY site_url`,
    [teamId]
  );
  const properties = propsRes.rows;
  if (properties.length === 0) return [];

  // Check if there's any daily data at all for this team
  const dataCheck = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM gsc_property_daily WHERE team_id = $1 LIMIT 1`,
    [teamId]
  );
  const hasDbData = Number(dataCheck.rows[0]?.cnt ?? 0) > 0;

  // If DB has data, use DB path
  if (hasDbData) {
    return fetchFromDb(pool, properties, params);
  }

  // No DB data yet — fall back to live GSC API
  const token = await getAccessTokenForTeam(teamId);
  if (!token) {
    // No token either — return properties with empty data
    return properties.map((p) => ({
      siteUrl: p.site_url,
      clicks: 0,
      impressions: 0,
      clicksChangePercent: 0,
      impressionsChangePercent: 0,
      daily: [],
    }));
  }

  return fetchFromGscApi(properties, token, startDate, endDate, priorStartDate, priorEndDate);
}

async function fetchFromGscApi(
  properties: { id: string; site_url: string; gsc_site_url: string | null }[],
  token: string,
  startDate: string,
  endDate: string,
  priorStartDate: string,
  priorEndDate: string,
): Promise<SiteOverviewMetrics[]> {
  const result: SiteOverviewMetrics[] = [];

  for (const prop of properties) {
    const gscUrl = prop.gsc_site_url || `https://${prop.site_url.replace(/^https?:\/\//, "")}`;
    try {
      const [currentRes, priorRes, dailyRes] = await Promise.all([
        querySearchAnalytics(gscUrl, startDate, endDate, [], undefined, token),
        querySearchAnalytics(gscUrl, priorStartDate, priorEndDate, [], undefined, token),
        querySearchAnalytics(gscUrl, startDate, endDate, ["date"], undefined, token),
      ]);
      const current = currentRes.rows[0];
      const prior = priorRes.rows[0];
      const clicks = current?.clicks ?? 0;
      const impressions = current?.impressions ?? 0;
      const position = current?.position ?? undefined;
      const priorClicks = prior?.clicks ?? 0;
      const priorImpressions = prior?.impressions ?? 0;
      const priorPosition = prior?.position ?? undefined;
      const daily = (dailyRes.rows ?? [])
        .map((r) => ({
          date: r.keys[0] ?? "",
          clicks: r.clicks,
          impressions: r.impressions,
          position: r.position,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      result.push({
        siteUrl: prop.site_url,
        clicks,
        impressions,
        clicksChangePercent: priorClicks > 0 ? Math.round(((clicks - priorClicks) / priorClicks) * 100) : 0,
        impressionsChangePercent: priorImpressions > 0 ? Math.round(((impressions - priorImpressions) / priorImpressions) * 100) : 0,
        position,
        positionChangePercent:
          position != null && priorPosition != null && priorPosition > 0
            ? Math.round(((position - priorPosition) / priorPosition) * 100)
            : undefined,
        daily,
      });
    } catch {
      result.push({
        siteUrl: prop.site_url,
        clicks: 0,
        impressions: 0,
        clicksChangePercent: 0,
        impressionsChangePercent: 0,
        daily: [],
      });
    }
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchFromDb(
  pool: any,
  properties: { id: string; site_url: string; gsc_site_url: string | null }[],
  params: OverviewParams,
): Promise<SiteOverviewMetrics[]> {
  const { teamId, startDate, endDate, priorStartDate, priorEndDate } = params;
  const result: SiteOverviewMetrics[] = [];

  for (const prop of properties) {
    const [currentRes, priorRes, dailyRes] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(clicks), 0)::text AS clicks,
           COALESCE(SUM(impressions), 0)::text AS impressions,
           COALESCE(SUM(position_sum), 0)::text AS position_sum
         FROM gsc_property_daily
         WHERE property_id = $1 AND team_id = $2 AND date BETWEEN $3::date AND $4::date`,
        [prop.id, teamId, startDate, endDate]
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(clicks), 0)::text AS clicks,
           COALESCE(SUM(impressions), 0)::text AS impressions,
           COALESCE(SUM(position_sum), 0)::text AS position_sum
         FROM gsc_property_daily
         WHERE property_id = $1 AND team_id = $2 AND date BETWEEN $3::date AND $4::date`,
        [prop.id, teamId, priorStartDate, priorEndDate]
      ),
      pool.query(
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

    const daily = (dailyRes.rows ?? []).map((r: { date: string; clicks: number; impressions: number; position_sum: string }) => {
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
      clicksChangePercent: priorClicks > 0 ? Math.round(((clicks - priorClicks) / priorClicks) * 100) : 0,
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
