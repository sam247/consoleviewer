import { getBingAccessTokenForTeam } from "@/lib/bing-tokens";

const BING_API_BASE = "https://ssl.bing.com/webmaster/api.svc/json";

function safeNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getField(obj: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    if (obj[name] != null) return obj[name];
    const lower = name.toLowerCase();
    if (obj[lower] != null) return obj[lower];
  }
  return undefined;
}

function getNumber(obj: Record<string, unknown>, names: string[]): number {
  return safeNumber(getField(obj, names));
}

function getDateString(obj: Record<string, unknown>): string {
  const raw = getField(obj, ["Date", "Day", "date"]);
  const str = typeof raw === "string" && raw.trim().length > 0 ? raw : null;
  if (!str) return "";
  const msMatch = str.match(/\/Date\(([-]?\d+)(?:[+-]\d{4})?\)\//);
  if (msMatch) {
    const ms = Number(msMatch[1]);
    if (Number.isFinite(ms)) return new Date(ms).toISOString().slice(0, 10);
  }
  if (/^\d{10}$/.test(str)) {
    const sec = Number(str);
    if (Number.isFinite(sec)) return new Date(sec * 1000).toISOString().slice(0, 10);
  }
  if (/^\d{13}$/.test(str)) {
    const ms = Number(str);
    if (Number.isFinite(ms)) return new Date(ms).toISOString().slice(0, 10);
  }
  const d = new Date(str);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}

async function callBing(path: string, token: string, params: Record<string, string>): Promise<unknown[] | null> {
  const sp = new URLSearchParams(params);
  const res = await fetch(`${BING_API_BASE}/${path}?${sp.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  const d = (data as { d?: unknown }).d;
  if (Array.isArray(d)) return d;
  if (d && typeof d === "object") {
    const obj = d as Record<string, unknown>;
    const candidates = [
      obj.Results,
      obj.results,
      obj.Data,
      obj.data,
      obj.Items,
      obj.items,
      obj.Rows,
      obj.rows,
      obj.QueryStats,
      obj.PageStats,
    ];
    for (const c of candidates) {
      if (Array.isArray(c)) return c;
    }
  }
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const candidates = [
      obj.Results,
      obj.results,
      obj.Data,
      obj.data,
      obj.Items,
      obj.items,
      obj.Rows,
      obj.rows,
      obj.QueryStats,
      obj.PageStats,
    ];
    for (const c of candidates) {
      if (Array.isArray(c)) return c;
    }
  }
  return [];
}

export type BingOverviewResult = {
  clicks: number;
  impressions: number;
  daily: { date: string; clicks: number; impressions: number; position?: number }[];
  dailySparse?: { date: string; clicks: number; impressions: number; position?: number }[];
};

/**
 * Fetch Bing Webmaster stats for one site URL and date range.
 * Returns totals and daily series for use in dashboard overview.
 */
export async function fetchBingOverviewForSite(
  token: string,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<BingOverviewResult> {
  const from = startDate.slice(0, 10);
  const to = endDate.slice(0, 10);
  const inRange = (d: string) => d >= from && d <= to;

  const siteUrlVariants = [
    siteUrl,
    siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : `${siteUrl}/`,
  ].filter(Boolean);

  let queryStatsRaw: unknown[] = [];
  for (const variant of siteUrlVariants) {
    const rows = await callBing("GetQueryStats", token, { siteUrl: variant });
    if (rows && rows.length > 0) {
      queryStatsRaw = rows;
      break;
    }
  }

  const queryRows = (queryStatsRaw ?? []).filter((entry) => {
    const obj = entry as Record<string, unknown>;
    const date = getDateString(obj);
    return date ? inRange(date) : true;
  });

  const dailyByDate = new Map<string, { clicks: number; impressions: number; posWeighted: number }>();
  for (const entry of queryRows) {
    const obj = entry as Record<string, unknown>;
    const date = getDateString(obj);
    if (!date || !inRange(date)) continue;
    const clicks = getNumber(obj, ["Clicks", "clicks"]);
    const impressions = getNumber(obj, ["Impressions", "impressions"]);
    const posRaw = getField(obj, ["AvgClickPosition", "AvgImpressionPosition", "Position", "position"]);
    const pos = posRaw != null ? safeNumber(posRaw) : 0;
    const cur = dailyByDate.get(date) ?? { clicks: 0, impressions: 0, posWeighted: 0 };
    cur.clicks += clicks;
    cur.impressions += impressions;
    cur.posWeighted += pos * Math.max(clicks, 1);
    dailyByDate.set(date, cur);
  }

  const dailyFromApi = Array.from(dailyByDate.entries())
    .map(([date, agg]) => ({
      date,
      clicks: agg.clicks,
      impressions: agg.impressions,
      position: agg.clicks > 0 ? agg.posWeighted / agg.clicks : undefined,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalClicks = dailyFromApi.reduce((s, d) => s + d.clicks, 0);
  const totalImpressions = dailyFromApi.reduce((s, d) => s + d.impressions, 0);

  const byDate = new Map(dailyFromApi.map((d) => [d.date, d]));
  const daily: { date: string; clicks: number; impressions: number; position?: number }[] = [];
  let current = from;
  while (current <= to) {
    daily.push(
      byDate.get(current) ?? { date: current, clicks: 0, impressions: 0 }
    );
    const d = new Date(current + "T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + 1);
    current = d.toISOString().slice(0, 10);
  }

  return {
    clicks: totalClicks,
    impressions: totalImpressions,
    daily,
    dailySparse: dailyFromApi,
  };
}

/**
 * Fetch Bing overview for all properties that have bing_site_url.
 * Uses team token; returns one result per property (site_url as key).
 */
export async function getBingOverviewForTeam(
  teamId: string,
  properties: { id: string; site_url: string; bing_site_url: string | null }[],
  startDate: string,
  endDate: string
): Promise<Map<string, BingOverviewResult>> {
  const token = await getBingAccessTokenForTeam(teamId);
  const result = new Map<string, BingOverviewResult>();
  if (!token) return result;

  await Promise.all(
    properties
      .filter((p) => p.bing_site_url)
      .map(async (p) => {
        const data = await fetchBingOverviewForSite(
          token,
          p.bing_site_url!,
          startDate,
          endDate
        );
        result.set(p.site_url, data);
      })
  );

  return result;
}
