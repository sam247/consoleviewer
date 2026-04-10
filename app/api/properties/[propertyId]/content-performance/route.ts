import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getPool } from "@/lib/db";

type PageAgg = {
  page_id: number;
  page: string;
  clicks: number;
  impressions: number;
};

function parseYmd(value: string): Date {
  const [y, m, d] = value.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function formatYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function daysInclusive(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / (24 * 60 * 60 * 1000)) + 1);
}

function extractPath(value: string): string {
  const v = value.trim();
  if (!v) return "/";
  try {
    if (v.startsWith("http://") || v.startsWith("https://")) return new URL(v).pathname || "/";
  } catch {}
  if (v.startsWith("/")) return v;
  try {
    return new URL(`https://${v}`).pathname || "/";
  } catch {
    return "/";
  }
}

function humanizeSegment(seg: string): string {
  const clean = seg
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
  if (!clean) return "Other";
  if (clean === "Www") return "Homepage";
  return clean;
}

type Group = {
  key: string;
  label: string;
  pageIds: number[];
  pages: number;
  clicks: number;
  impressions: number;
  clicksChangePercent?: number;
  impressionsChangePercent?: number;
  share: number;
  trend: number[];
};

function computeChange(current: number, prior: number): number | undefined {
  if (!Number.isFinite(prior) || prior <= 0) return undefined;
  return ((current - prior) / prior) * 100;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { propertyId: param } = await params;
  const resolved = await resolvePropertyForUser(userId, param);
  if (!resolved) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const startDate = sp.get("startDate")?.trim();
  const endDate = sp.get("endDate")?.trim();
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  const windowDays = daysInclusive(start, end);
  const priorEnd = addDays(start, -1);
  const priorStart = addDays(priorEnd, -(windowDays - 1));

  const pool = getPool();
  const currentRes = await pool.query<PageAgg>(
    `SELECT
       g.page_id::int AS page_id,
       p.page_url AS page,
       SUM(g.clicks)::int AS clicks,
       SUM(g.impressions)::int AS impressions
     FROM gsc_page_daily g
     JOIN page_dictionary p ON p.id = g.page_id
     WHERE g.property_id = $1 AND g.date BETWEEN $2::date AND $3::date
     GROUP BY g.page_id, p.page_url
     ORDER BY SUM(g.impressions) DESC
     LIMIT 5000`,
    [resolved.propertyId, startDate, endDate]
  );

  if (currentRes.rows.length === 0) {
    return NextResponse.json({ groups: [], startDate, endDate });
  }

  const priorRes = await pool.query<PageAgg>(
    `SELECT
       g.page_id::int AS page_id,
       p.page_url AS page,
       SUM(g.clicks)::int AS clicks,
       SUM(g.impressions)::int AS impressions
     FROM gsc_page_daily g
     JOIN page_dictionary p ON p.id = g.page_id
     WHERE g.property_id = $1 AND g.date BETWEEN $2::date AND $3::date
     GROUP BY g.page_id, p.page_url`,
    [resolved.propertyId, formatYmd(priorStart), formatYmd(priorEnd)]
  );

  const priorById = new Map<number, { clicks: number; impressions: number }>();
  for (const r of priorRes.rows) {
    priorById.set(r.page_id, { clicks: r.clicks, impressions: r.impressions });
  }

  const totalImpressions = currentRes.rows.reduce((s, r) => s + (r.impressions ?? 0), 0) || 1;

  const rawGroups = new Map<string, { label: string; pageIds: number[]; pages: number; clicks: number; impressions: number; priorClicks: number; priorImpr: number }>();

  for (const r of currentRes.rows) {
    const path = extractPath(r.page);
    const seg1 = path.split("/").filter(Boolean)[0];
    const key = seg1 ? `/${seg1}/` : "(root)";
    const label = seg1 ? humanizeSegment(seg1) : "Homepage";
    let g = rawGroups.get(key);
    if (!g) {
      g = { label, pageIds: [], pages: 0, clicks: 0, impressions: 0, priorClicks: 0, priorImpr: 0 };
      rawGroups.set(key, g);
    }
    g.pageIds.push(r.page_id);
    g.pages += 1;
    g.clicks += r.clicks;
    g.impressions += r.impressions;
    const prior = priorById.get(r.page_id);
    if (prior) {
      g.priorClicks += prior.clicks;
      g.priorImpr += prior.impressions;
    }
  }

  const groupsSorted = Array.from(rawGroups.entries())
    .map(([key, g]) => ({ key, ...g }))
    .sort((a, b) => b.impressions - a.impressions);

  const keep: string[] = [];
  for (const g of groupsSorted) {
    const share = g.impressions / totalImpressions;
    const enoughPages = g.pages >= 5;
    const enoughShare = share >= 0.03;
    if ((enoughPages || enoughShare) && keep.length < 6 && g.key !== "(root)") {
      keep.push(g.key);
    }
  }
  if (!keep.includes("(root)") && rawGroups.has("(root)") && keep.length < 6) {
    keep.push("(root)");
  }

  const topSet = new Set(keep);
  const other: Group = {
    key: "(other)",
    label: "Other",
    pageIds: [],
    pages: 0,
    clicks: 0,
    impressions: 0,
    share: 0,
    trend: [],
  };

  const selected: Group[] = [];
  for (const g of groupsSorted) {
    const base: Group = {
      key: g.key,
      label: g.label,
      pageIds: g.pageIds,
      pages: g.pages,
      clicks: g.clicks,
      impressions: g.impressions,
      clicksChangePercent: computeChange(g.clicks, g.priorClicks),
      impressionsChangePercent: computeChange(g.impressions, g.priorImpr),
      share: g.impressions / totalImpressions,
      trend: [],
    };
    if (topSet.has(g.key)) {
      selected.push(base);
    } else {
      other.pageIds.push(...g.pageIds);
      other.pages += g.pages;
      other.clicks += g.clicks;
      other.impressions += g.impressions;
    }
  }

  if (other.impressions > 0) {
    other.share = other.impressions / totalImpressions;
    selected.push(other);
  }

  const dateList: string[] = [];
  for (let d = new Date(start); d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    dateList.push(formatYmd(d));
  }

  const pageIdToGroup = new Map<number, string>();
  selected.forEach((g) => g.pageIds.forEach((id) => pageIdToGroup.set(id, g.key)));
  const allPageIds = Array.from(pageIdToGroup.keys());

  const trendByGroupDate = new Map<string, Map<string, number>>();
  selected.forEach((g) => trendByGroupDate.set(g.key, new Map()));

  if (allPageIds.length > 0) {
    const dailyRes = await pool.query<{ date: string; page_id: number; impressions: number }>(
      `SELECT g.date::text AS date, g.page_id::int AS page_id, SUM(g.impressions)::int AS impressions
       FROM gsc_page_daily g
       WHERE g.property_id = $1 AND g.date BETWEEN $2::date AND $3::date
         AND g.page_id = ANY($4::int[])
       GROUP BY g.date, g.page_id
       ORDER BY g.date`,
      [resolved.propertyId, startDate, endDate, allPageIds]
    );
    for (const row of dailyRes.rows) {
      const gk = pageIdToGroup.get(row.page_id);
      if (!gk) continue;
      const byDate = trendByGroupDate.get(gk);
      if (!byDate) continue;
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + (row.impressions ?? 0));
    }
  }

  for (const g of selected) {
    const byDate = trendByGroupDate.get(g.key) ?? new Map();
    g.trend = dateList.map((d) => byDate.get(d) ?? 0);
  }

  selected.sort((a, b) => b.share - a.share);

  return NextResponse.json({
    startDate,
    endDate,
    priorStartDate: formatYmd(priorStart),
    priorEndDate: formatYmd(priorEnd),
    groups: selected.map((g) => ({
      key: g.key,
      label: g.label,
      pages: g.pages,
      clicks: g.clicks,
      impressions: g.impressions,
      clicksChangePercent: g.clicksChangePercent,
      impressionsChangePercent: g.impressionsChangePercent,
      share: g.share,
      trend: g.trend,
    })),
  });
}

