import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getPool } from "@/lib/db";
import { getBingAccessTokenForTeam } from "@/lib/bing-tokens";

const BING_API_BASE = "https://ssl.bing.com/webmaster/api.svc/json";
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { expires: number; data: unknown }>();

type BingDailyRow = { date: string; clicks: number; impressions: number };

function cacheKey(propertyId: string, startDate: string, endDate: string) {
  return `${propertyId}:${startDate}:${endDate}:bing:v2`;
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
  if (!str) return "";
  // Support /Date(1709596800000)/ and /Date(1709596800000+0000)/ WCF formats.
  const msMatch = str.match(/\/Date\(([-]?\d+)(?:[+-]\d{4})?\)\//);
  if (msMatch) {
    const ms = Number(msMatch[1]);
    if (Number.isFinite(ms)) return new Date(ms).toISOString().slice(0, 10);
  }
  // Some payloads use UNIX epoch seconds as a string.
  if (/^\d{10}$/.test(str)) {
    const sec = Number(str);
    if (Number.isFinite(sec)) return new Date(sec * 1000).toISOString().slice(0, 10);
  }
  // Or UNIX epoch milliseconds as a string.
  if (/^\d{13}$/.test(str)) {
    const ms = Number(str);
    if (Number.isFinite(ms)) return new Date(ms).toISOString().slice(0, 10);
  }
  const d = new Date(str);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  // Unknown format: return empty so caller can avoid accidental false filtering.
  return "";
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
  const siteUrlVariants = (() => {
    const out = new Set<string>();
    const push = (v: string) => {
      const t = v.trim();
      if (t) out.add(t);
    };
    push(bingSiteUrl);
    try {
      const parsed = new URL(bingSiteUrl.startsWith("http") ? bingSiteUrl : `https://${bingSiteUrl}`);
      const hostNoWww = parsed.hostname.replace(/^www\./i, "");
      const hostWww = parsed.hostname.startsWith("www.") ? parsed.hostname : `www.${parsed.hostname}`;
      const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
      push(`https://${hostNoWww}${path}`);
      push(`https://${hostWww}${path}`);
      push(`http://${hostNoWww}${path}`);
      push(`http://${hostWww}${path}`);
      push(`https://${hostNoWww}${path}/`);
      push(`https://${hostWww}${path}/`);
      push(`http://${hostNoWww}${path}/`);
      push(`http://${hostWww}${path}/`);
    } catch {
      push(bingSiteUrl.endsWith("/") ? bingSiteUrl.slice(0, -1) : `${bingSiteUrl}/`);
    }
    return Array.from(out);
  })();

  let queryStatsRaw: unknown[] = [];
  let pageStatsRaw: unknown[] = [];

  for (const variant of siteUrlVariants) {
    const qRows = (await callBing("GetQueryStats", token, { siteUrl: variant })) ?? [];
    const pRows = qRows.length > 0 ? [] : (await callBing("GetPageStats", token, { siteUrl: variant })) ?? [];
    const pickedRows = qRows.length > 0 ? qRows : pRows;
    if (pickedRows.length > 0) {
      queryStatsRaw = qRows;
      pageStatsRaw = pRows;
      break;
    }
  }

  const from = toDateOnly(startDate);
  const to = toDateOnly(endDate);
  const inRange = (d: string) => d >= from && d <= to;

  const queryRows = [...queryStatsRaw, ...pageStatsRaw].filter((entry) => {
    const obj = entry as Record<string, unknown>;
    const date = getDateString(obj);
    return date ? inRange(date) : true;
  });

  const dailyByDate = new Map<string, { clicks: number; impressions: number }>();
  let undatedClicks = 0;
  let undatedImpressions = 0;
  for (const entry of queryRows) {
    const obj = entry as Record<string, unknown>;
    const date = getDateString(obj);
    const clicks = getNumber(obj, ["Clicks", "clicks"]);
    const impressions = getNumber(obj, ["Impressions", "impressions"]);
    if (!date || !inRange(date)) {
      undatedClicks += clicks;
      undatedImpressions += impressions;
      continue;
    }
    const cur = dailyByDate.get(date) ?? { clicks: 0, impressions: 0 };
    cur.clicks += clicks;
    cur.impressions += impressions;
    dailyByDate.set(date, cur);
  }

  const dailyFromApi = Array.from(dailyByDate.entries())
    .map(([date, agg]) => ({ date, clicks: agg.clicks, impressions: agg.impressions }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (dailyFromApi.length === 0 && (undatedClicks > 0 || undatedImpressions > 0)) {
    let cursor = from;
    const days: string[] = [];
    while (cursor <= to) {
      days.push(cursor);
      const d = new Date(cursor + "T00:00:00.000Z");
      d.setUTCDate(d.getUTCDate() + 1);
      cursor = d.toISOString().slice(0, 10);
    }
    const dayCount = Math.max(1, days.length);
    let clicksLeft = undatedClicks;
    let impressionsLeft = undatedImpressions;
    for (let i = 0; i < days.length; i += 1) {
      const isLast = i === days.length - 1;
      const clicks = isLast ? clicksLeft : Math.floor(clicksLeft / (dayCount - i));
      const impressions = isLast ? impressionsLeft : Math.floor(impressionsLeft / (dayCount - i));
      clicksLeft -= clicks;
      impressionsLeft -= impressions;
      dailyFromApi.push({ date: days[i], clicks, impressions });
    }
  }
  const byDate = new Map(dailyFromApi.map((d) => [d.date, d]));
  const daily: BingDailyRow[] = [];
  let current = from;
  while (current <= to) {
    const existing = byDate.get(current);
    daily.push(
      existing ?? { date: current, clicks: 0, impressions: 0 }
    );
    const d = new Date(current + "T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + 1);
    current = d.toISOString().slice(0, 10);
  }

  const analyticsReady = daily.some((d) => d.clicks > 0 || d.impressions > 0);
  const data = {
    connected: true,
    analyticsReady,
    daily,
    dailySparse: dailyFromApi,
  };
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
  return NextResponse.json(data);
}
