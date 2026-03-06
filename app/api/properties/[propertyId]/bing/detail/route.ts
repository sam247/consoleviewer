import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getPool } from "@/lib/db";
import { getBingAccessTokenForTeam } from "@/lib/bing-tokens";

const BING_API_BASE = "https://ssl.bing.com/webmaster/api.svc/json";
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { expires: number; data: unknown }>();

type BingDailyRow = { date: string; clicks: number; impressions: number; ctr?: number; position?: number };
type BingTableRow = { key: string; clicks: number; impressions: number; changePercent: number; position?: number };

function cacheKey(propertyId: string, startDate: string, endDate: string) {
  return `${propertyId}:${startDate}:${endDate}:bing`;
}

function safeNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asNonEmptyString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
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
  const str = asNonEmptyString(raw);
  return str ? str.slice(0, 10) : "";
}

function toDateOnly(value: string) {
  return value.slice(0, 10);
}

async function callBing(path: string, token: string, params: Record<string, string>) {
  const sp = new URLSearchParams(params);
  const res = await fetch(`${BING_API_BASE}/${path}?${sp.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as unknown;
  const d = (data as { d?: unknown }).d;
  if (Array.isArray(d)) return d;
  if (Array.isArray(data)) return data;
  return [];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { propertyId: param } = await params;
  const resolved = await resolvePropertyForUser(userId, param);
  if (!resolved) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const startDate = request.nextUrl.searchParams.get("startDate");
  const endDate = request.nextUrl.searchParams.get("endDate");
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Missing startDate or endDate" }, { status: 400 });
  }

  const key = cacheKey(resolved.propertyId, startDate, endDate);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const pool = getPool();
  const propRes = await pool.query<{ bing_site_url: string | null }>(
    `SELECT bing_site_url FROM properties WHERE id = $1`,
    [resolved.propertyId]
  );
  const bingSiteUrl = propRes.rows[0]?.bing_site_url;
  if (!bingSiteUrl) {
    const data = { connected: false, analyticsReady: false, daily: [], queries: [], pages: [] };
    cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(data);
  }

  const token = await getBingAccessTokenForTeam(resolved.teamId);
  if (!token) {
    const data = { connected: false, analyticsReady: false, daily: [], queries: [], pages: [] };
    cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(data);
  }

  // NOTE: Bing endpoint response shapes vary across accounts/features.
  // We try commonly available stat endpoints and normalize defensively.
  const [queryStatsRaw, pageStatsRaw] = await Promise.all([
    callBing("GetQueryStats", token, { siteUrl: bingSiteUrl }),
    callBing("GetPageStats", token, { siteUrl: bingSiteUrl }),
  ]);

  const from = toDateOnly(startDate);
  const to = toDateOnly(endDate);
  const inRange = (d: string) => d >= from && d <= to;

  const queryRows = (queryStatsRaw ?? []).filter((entry) => {
    const obj = entry as Record<string, unknown>;
    const date = getDateString(obj);
    return date ? inRange(date) : true;
  });
  const pageRows = (pageStatsRaw ?? []).filter((entry) => {
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

  const daily: BingDailyRow[] = Array.from(dailyByDate.entries())
    .map(([date, agg]) => ({
      date,
      clicks: agg.clicks,
      impressions: agg.impressions,
      ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
      position: agg.clicks > 0 ? agg.posWeighted / agg.clicks : undefined,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const aggregateByKey = (rows: unknown[], keyNames: string[]): BingTableRow[] => {
    const byKey = new Map<string, { clicks: number; impressions: number; posWeighted: number; weight: number }>();
    for (const entry of rows) {
      const obj = entry as Record<string, unknown>;
      const key = asNonEmptyString(getField(obj, keyNames));
      if (!key) continue;
      const clicks = getNumber(obj, ["Clicks", "clicks"]);
      const impressions = getNumber(obj, ["Impressions", "impressions"]);
      const posRaw = getField(obj, ["AvgClickPosition", "AvgImpressionPosition", "Position", "position"]);
      const pos = posRaw != null ? safeNumber(posRaw) : 0;
      const weight = Math.max(clicks, 1);
      const cur = byKey.get(key) ?? { clicks: 0, impressions: 0, posWeighted: 0, weight: 0 };
      cur.clicks += clicks;
      cur.impressions += impressions;
      cur.posWeighted += pos * weight;
      cur.weight += weight;
      byKey.set(key, cur);
    }
    return Array.from(byKey.entries())
      .map(([key, agg]) => ({
        key,
        clicks: agg.clicks,
        impressions: agg.impressions,
        changePercent: 0,
        position: agg.weight > 0 ? agg.posWeighted / agg.weight : undefined,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 100);
  };

  const queries = aggregateByKey(queryRows, ["Query", "QueryText", "query", "keyword"]);
  const pages = aggregateByKey(pageRows, ["Page", "Url", "page", "url"]);
  const analyticsReady = daily.length > 0 || queries.length > 0 || pages.length > 0;
  const data = {
    connected: true,
    analyticsReady,
    daily,
    queries,
    pages,
  };
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
  return NextResponse.json(data);
}

