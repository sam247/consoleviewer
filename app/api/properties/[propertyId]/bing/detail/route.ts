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

function normalizeStatsRows(rows: unknown[]): BingTableRow[] {
  const out: BingTableRow[] = [];
  for (const entry of rows) {
    const obj = entry as Record<string, unknown>;
    const key = asNonEmptyString(obj.Query) ?? asNonEmptyString(obj.Page) ?? asNonEmptyString(obj.Url);
    if (!key) continue;
    const clicks = safeNumber(obj.Clicks);
    const impressions = safeNumber(obj.Impressions);
    const position = obj.Position != null ? safeNumber(obj.Position) : undefined;
    out.push({
      key,
      clicks,
      impressions,
      changePercent: 0,
      position: position != null && Number.isFinite(position) ? position : undefined,
    });
    if (out.length >= 100) break;
  }
  return out;
}

function normalizeDailyRows(rows: unknown[]): BingDailyRow[] {
  const out: BingDailyRow[] = [];
  for (const entry of rows) {
    const obj = entry as Record<string, unknown>;
    const dateRaw = asNonEmptyString(obj.Date) ?? asNonEmptyString(obj.Day) ?? asNonEmptyString(obj.date) ?? "";
    const date = dateRaw ? dateRaw.slice(0, 10) : "";
    if (!date) continue;
    const clicks = safeNumber(obj.Clicks);
    const impressions = safeNumber(obj.Impressions);
    const position = obj.Position != null ? safeNumber(obj.Position) : undefined;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    out.push({ date, clicks, impressions, ctr, position });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
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
  const [queryStatsRaw, pageStatsRaw, dailyRaw] = await Promise.all([
    callBing("GetQueryStats", token, { siteUrl: bingSiteUrl, startDate, endDate }),
    callBing("GetPageStats", token, { siteUrl: bingSiteUrl, startDate, endDate }),
    callBing("GetTrafficData", token, { siteUrl: bingSiteUrl, startDate, endDate }),
  ]);

  const queries = normalizeStatsRows(queryStatsRaw ?? []);
  const pages = normalizeStatsRows(pageStatsRaw ?? []);
  const daily = normalizeDailyRows(dailyRaw ?? []);
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

