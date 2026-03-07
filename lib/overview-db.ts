import { getPool } from "@/lib/db";
import { getAccessTokenForTeam } from "@/lib/gsc-tokens";
import { querySearchAnalytics } from "@/lib/gsc";
import { getBingOverviewForTeam } from "@/lib/bing-overview";
import type { SiteOverviewMetrics } from "@/types/gsc";

export type OverviewParams = {
  teamId: string;
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
};

type TrackedKeywordStats = {
  trackedKeywordCount: number;
  avgTrackedRank?: number;
  avgTrackedRankDelta?: number;
};

async function getTrackedKeywordStatsByProperty(
  pool: ReturnType<typeof getPool>,
  teamId: string,
  propertyIds: string[]
): Promise<Map<string, TrackedKeywordStats>> {
  if (propertyIds.length === 0) return new Map();

  const res = await pool.query<{
    property_id: string;
    tracked_keyword_count: number;
    avg_tracked_rank: string | null;
    avg_tracked_rank_delta: string | null;
  }>(
    `WITH active_keywords AS (
       SELECT rk.id, rk.property_id
       FROM rank_keywords rk
       WHERE rk.team_id = $1
         AND rk.active = true
         AND rk.property_id = ANY($2::uuid[])
     ),
     latest_positions AS (
       SELECT
         ak.property_id,
         ak.id AS keyword_id,
         latest.position AS latest_position,
         prev.position AS prev_position
       FROM active_keywords ak
       LEFT JOIN LATERAL (
         SELECT rp.position
         FROM rank_positions rp
         WHERE rp.keyword_id = ak.id
         ORDER BY rp.date DESC, rp.created_at DESC
         LIMIT 1
       ) latest ON TRUE
       LEFT JOIN LATERAL (
         SELECT rp.position
         FROM rank_positions rp
         WHERE rp.keyword_id = ak.id
         ORDER BY rp.date DESC, rp.created_at DESC
         OFFSET 1
         LIMIT 1
       ) prev ON TRUE
     )
     SELECT
       lp.property_id::text AS property_id,
       COUNT(*)::int AS tracked_keyword_count,
       AVG(lp.latest_position)::text AS avg_tracked_rank,
       AVG(
         CASE
           WHEN lp.latest_position IS NOT NULL AND lp.prev_position IS NOT NULL
             THEN lp.latest_position - lp.prev_position
           ELSE NULL
         END
       )::text AS avg_tracked_rank_delta
     FROM latest_positions lp
     GROUP BY lp.property_id`,
    [teamId, propertyIds]
  );

  const out = new Map<string, TrackedKeywordStats>();
  for (const row of res.rows) {
    const avgTrackedRank = row.avg_tracked_rank != null ? Number(row.avg_tracked_rank) : undefined;
    const avgTrackedRankDelta =
      row.avg_tracked_rank_delta != null ? Number(row.avg_tracked_rank_delta) : undefined;
    out.set(row.property_id, {
      trackedKeywordCount: Number(row.tracked_keyword_count) || 0,
      avgTrackedRank: Number.isFinite(avgTrackedRank ?? NaN) ? avgTrackedRank : undefined,
      avgTrackedRankDelta: Number.isFinite(avgTrackedRankDelta ?? NaN) ? avgTrackedRankDelta : undefined,
    });
  }
  return out;
}

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

  const propsRes = await pool.query<{ id: string; site_url: string; gsc_site_url: string | null; bing_site_url: string | null }>(
    `SELECT id, site_url, gsc_site_url, bing_site_url FROM properties WHERE team_id = $1 AND active = true ORDER BY site_url`,
    [teamId]
  );
  const properties = propsRes.rows;
  if (properties.length === 0) return [];

  const trackedKeywordStatsByProperty = await getTrackedKeywordStatsByProperty(
    pool,
    teamId,
    properties.map((p) => p.id)
  );

  // Check if there's any daily data at all for this team
  const dataCheck = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM gsc_property_daily WHERE team_id = $1 LIMIT 1`,
    [teamId]
  );
  const hasDbData = Number(dataCheck.rows[0]?.cnt ?? 0) > 0;

  let result: SiteOverviewMetrics[];
  if (hasDbData) {
    result = await fetchFromDb(pool, properties, params, trackedKeywordStatsByProperty);
  } else {
    const token = await getAccessTokenForTeam(teamId);
    if (!token) {
      return properties.map((p) => ({
        siteUrl: p.site_url,
        clicks: 0,
        impressions: 0,
        clicksChangePercent: 0,
        impressionsChangePercent: 0,
        bingConnected: !!p.bing_site_url,
        daily: [],
      }));
    }
    result = await fetchFromGscApi(
      properties,
      token,
      startDate,
      endDate,
      priorStartDate,
      priorEndDate,
      trackedKeywordStatsByProperty
    );
  }

  const hasBing = properties.some((p) => p.bing_site_url);
  if (hasBing) {
    const bingMap = await getBingOverviewForTeam(teamId, properties, startDate, endDate);
    for (const row of result) {
      const bing = bingMap.get(row.siteUrl);
      if (bing?.daily?.length) {
        row.bingDaily = bing.daily.map((d) => ({ date: d.date, clicks: d.clicks, impressions: d.impressions }));
      }
    }
  }
  return result;
}

async function fetchFromGscApi(
  properties: { id: string; site_url: string; gsc_site_url: string | null; bing_site_url: string | null }[],
  token: string,
  startDate: string,
  endDate: string,
  priorStartDate: string,
  priorEndDate: string,
  trackedKeywordStatsByProperty: Map<string, TrackedKeywordStats>
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
        trackedKeywordCount: trackedKeywordStatsByProperty.get(prop.id)?.trackedKeywordCount ?? 0,
        avgTrackedRank: trackedKeywordStatsByProperty.get(prop.id)?.avgTrackedRank,
        avgTrackedRankDelta: trackedKeywordStatsByProperty.get(prop.id)?.avgTrackedRankDelta,
        bingConnected: !!prop.bing_site_url,
        daily,
      });
    } catch {
      result.push({
        siteUrl: prop.site_url,
        clicks: 0,
        impressions: 0,
        clicksChangePercent: 0,
        impressionsChangePercent: 0,
        trackedKeywordCount: trackedKeywordStatsByProperty.get(prop.id)?.trackedKeywordCount ?? 0,
        avgTrackedRank: trackedKeywordStatsByProperty.get(prop.id)?.avgTrackedRank,
        avgTrackedRankDelta: trackedKeywordStatsByProperty.get(prop.id)?.avgTrackedRankDelta,
        bingConnected: !!prop.bing_site_url,
        daily: [],
      });
    }
  }
  return result;
}

async function fetchFromDb(
  pool: ReturnType<typeof getPool>,
  properties: { id: string; site_url: string; gsc_site_url: string | null; bing_site_url: string | null }[],
  params: OverviewParams,
  trackedKeywordStatsByProperty: Map<string, TrackedKeywordStats>
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
      trackedKeywordCount: trackedKeywordStatsByProperty.get(prop.id)?.trackedKeywordCount ?? 0,
      avgTrackedRank: trackedKeywordStatsByProperty.get(prop.id)?.avgTrackedRank,
      avgTrackedRankDelta: trackedKeywordStatsByProperty.get(prop.id)?.avgTrackedRankDelta,
      bingConnected: !!prop.bing_site_url,
      daily,
    });
  }

  return result;
}
