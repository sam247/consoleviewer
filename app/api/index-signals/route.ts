import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getPool } from "@/lib/db";
import { getSiteDetail, querySearchAnalytics } from "@/lib/gsc";
import { getAccessTokenForTeam } from "@/lib/gsc-tokens";

export type IndexSignalRow = {
  id: string;
  url: string;
  label: string | null;
  signal: "warning" | "stable";
  lastSeen: string | null;
  impressionsDelta: number | null;
  flags: string[];
};

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const propertyId = request.nextUrl.searchParams.get("propertyId");
  if (!propertyId?.trim()) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  const resolved = await resolvePropertyForUser(userId, propertyId.trim());
  if (!resolved) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const pool = getPool();
  const propRes = await pool.query<{ site_url: string; gsc_site_url: string | null }>(
    `SELECT site_url, gsc_site_url FROM properties WHERE id = $1 LIMIT 1`,
    [resolved.propertyId]
  );
  const siteUrl = propRes.rows[0]?.gsc_site_url || propRes.rows[0]?.site_url || "";
  const wlRes = await pool.query<{ id: string; url: string; label: string | null }>(
    `SELECT id::text AS id, url, label
     FROM index_watchlist
     WHERE owner_user_id = $1
       AND property_id = $2`,
    [userId, resolved.propertyId]
  );
  const watchlist = wlRes.rows ?? [];

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 14);
  const priorEnd = new Date(start);
  priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - 14);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  let pages: { key: string; impressions: number; clicks: number; changePercent?: number }[] = [];
  let priorPages: { key: string; impressions: number }[] = [];
  try {
    const token = await getAccessTokenForTeam(resolved.teamId);
    const [detail, priorPageRes] = await Promise.all([
      getSiteDetail(
        siteUrl,
        fmt(start),
        fmt(end),
        fmt(priorStart),
        fmt(priorEnd),
        undefined,
        token
      ),
      querySearchAnalytics(siteUrl, fmt(priorStart), fmt(priorEnd), ["page"], undefined, token ?? undefined),
    ]);
    pages = (detail.pages ?? []).map((p) => ({
      key: p.key,
      impressions: p.impressions,
      clicks: p.clicks,
      changePercent: p.changePercent,
    }));
    priorPages = (priorPageRes.rows ?? []).map((r) => ({
      key: r.keys[0] ?? "",
      impressions: r.impressions,
    }));
  } catch {
    // GSC failed; still return watchlist with "No data" signals
  }

  const pageMap = new Map(pages.map((p) => [p.key, p]));
  const priorMap = new Map(priorPages.map((p) => [p.key, p]));

  const signals: IndexSignalRow[] = watchlist.map((w) => {
    const page = pageMap.get(w.url);
    const prior = priorMap.get(w.url);
    const flags: string[] = [];
    let signal: "warning" | "stable" = "stable";
    const lastSeen: string | null = page ? fmt(end) : null;
    const impressionsDelta: number | null = page?.changePercent ?? null;

    if (!page) {
      flags.push("No impressions in last 14 days");
      signal = "warning";
      if (prior && prior.impressions > 0) {
        flags.push("Dropped to 0 vs prior");
      }
    } else {
      if (prior && prior.impressions > 0 && page.impressions === 0) {
        flags.push("Dropped to 0 vs prior");
        signal = "warning";
      }
    }

    return {
      id: w.id,
      url: w.url,
      label: w.label,
      signal,
      lastSeen,
      impressionsDelta,
      flags,
    };
  });

  const warnings = signals.filter((s) => s.signal === "warning").length;
  const stable = signals.filter((s) => s.signal === "stable").length;

  return NextResponse.json({
    signals,
    summary: { total: signals.length, warnings, stable },
    siteUrl,
  });
}
