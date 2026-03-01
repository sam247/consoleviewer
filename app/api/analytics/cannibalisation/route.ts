import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "@/lib/session";
import { getQueryPagePairs } from "@/lib/gsc";
import type { QueryPagePair } from "@/types/gsc";

const MIN_IMPRESSIONS = 50;
const MAX_BEST_POSITION = 30;
const CONFLICT_CAP = 50;

export type CannibalisationConflict = {
  query: string;
  impressions: number;
  clicks: number;
  numUrls: number;
  bestPosition: number;
  score: number;
  urls: { page: string; clicks: number; position: number }[];
  primary_url: string;
};

export async function GET(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const site = request.nextUrl.searchParams.get("site");
  const startDate = request.nextUrl.searchParams.get("startDate");
  const endDate = request.nextUrl.searchParams.get("endDate");
  if (!site?.trim() || !startDate?.trim() || !endDate?.trim()) {
    return NextResponse.json(
      { error: "site, startDate and endDate required" },
      { status: 400 }
    );
  }

  const pairs = await getQueryPagePairs(site, startDate, endDate);
  const byQuery = new Map<string, QueryPagePair[]>();
  for (const p of pairs) {
    if (!p.query.trim()) continue;
    const list = byQuery.get(p.query) ?? [];
    list.push(p);
    byQuery.set(p.query, list);
  }

  const conflicts: CannibalisationConflict[] = [];
  for (const [query, list] of Array.from(byQuery.entries())) {
    const distinctPages = new Set(list.map((r) => r.page)).size;
    const totalImpressions = list.reduce((s, r) => s + r.impressions, 0);
    const bestPosition = Math.min(...list.map((r) => r.position));
    if (
      distinctPages < 2 ||
      totalImpressions < MIN_IMPRESSIONS ||
      bestPosition > MAX_BEST_POSITION
    ) {
      continue;
    }

    const positions = list.map((r) => r.position);
    const volatility = Math.max(...positions) - Math.min(...positions);
    const numPages = distinctPages;
    const score =
      totalImpressions * (1 + volatility) * (1 + (numPages - 1) * 0.25);

    const byPage = new Map<string, { clicks: number; position: number }[]>();
    for (const r of list) {
      const cur = byPage.get(r.page) ?? [];
      cur.push({ clicks: r.clicks, position: r.position });
      byPage.set(r.page, cur);
    }
    const pageAgg = Array.from(byPage.entries()).map(([page, arr]) => {
      const clicks = arr.reduce((s, x) => s + x.clicks, 0);
      const position = arr.reduce((s, x) => s + x.position, 0) / arr.length;
      return { page, clicks, position };
    });
    const primary = pageAgg.sort(
      (a, b) => b.clicks - a.clicks || a.position - b.position
    )[0];
    const primary_url = primary?.page ?? list[0].page;
    const totalClicks = list.reduce((s, r) => s + r.clicks, 0);

    conflicts.push({
      query,
      impressions: totalImpressions,
      clicks: totalClicks,
      numUrls: numPages,
      bestPosition,
      score,
      urls: pageAgg.map((u) => ({
        page: u.page,
        clicks: u.clicks,
        position: u.position,
      })),
      primary_url,
    });
  }

  conflicts.sort((a, b) => b.score - a.score);
  const capped = conflicts.slice(0, CONFLICT_CAP);

  return NextResponse.json({ conflicts: capped });
}
