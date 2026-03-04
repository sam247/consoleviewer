import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { ensureTeamForUser } from "@/lib/team";
import { getPool } from "@/lib/db";

const MAX_SITES = 50;

/**
 * Normalize GSC site URL to https form for site_url column.
 * sc-domain:example.com → https://example.com
 * https://example.com/ → https://example.com
 */
function normalizeSiteUrl(gscSiteUrl: string): string | null {
  const s = gscSiteUrl.trim();
  if (!s) return null;
  if (s.startsWith("sc-domain:")) {
    const domain = s.slice("sc-domain:".length).replace(/\/+$/, "");
    if (!domain) return null;
    return `https://${domain}`;
  }
  try {
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    const normalized = `https://${url.hostname}${url.pathname === "/" ? "" : url.pathname}`.replace(/\/+$/, "");
    return normalized || "https://" + url.hostname;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = await ensureTeamForUser(userId);

  let body: { sites?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw = body.sites;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "sites must be a non-empty array" }, { status: 400 });
  }
  if (raw.length > MAX_SITES) {
    return NextResponse.json({ error: `Maximum ${MAX_SITES} sites per request` }, { status: 400 });
  }
  const gscSiteUrls = raw
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean) as string[];

  const toInsert: { site_url: string; gsc_site_url: string }[] = [];
  const seen = new Set<string>();
  for (const gscUrl of gscSiteUrls) {
    const siteUrl = normalizeSiteUrl(gscUrl);
    if (!siteUrl || seen.has(siteUrl)) continue;
    seen.add(siteUrl);
    toInsert.push({ site_url: siteUrl, gsc_site_url: gscUrl });
  }

  const pool = getPool();
  const imported: { id: string; site_url: string; gsc_site_url: string | null }[] = [];

  for (const { site_url, gsc_site_url } of toInsert) {
    const insertRes = await pool.query<{ id: string; site_url: string; gsc_site_url: string | null }>(
      `INSERT INTO properties (id, team_id, site_url, gsc_site_url, timezone, active, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NULL, true, now())
       ON CONFLICT (team_id, site_url) DO UPDATE
       SET gsc_site_url = EXCLUDED.gsc_site_url
       RETURNING id, site_url, gsc_site_url`,
      [teamId, site_url, gsc_site_url]
    );
    const row = insertRes.rows[0];
    if (row) {
      imported.push(row);
      await pool.query(
        `INSERT INTO property_integrations (property_id, integration_type, status, connected_at)
         VALUES ($1, 'gsc', 'connected', now())
         ON CONFLICT (property_id, integration_type) DO UPDATE
         SET status = 'connected', connected_at = now()`,
        [row.id]
      );
    }
  }

  return NextResponse.json({ imported: imported.length, properties: imported });
}
