import { resolvePropertyForUser } from "@/lib/property-resolver";
import { readQuery } from "@/mcp/db";
import type { ToolInput } from "@/mcp/types";

type PropertyRow = {
  id: string;
  team_id: string;
  site_url: string;
  gsc_site_url: string | null;
};

type DateWindow = {
  latestDate: string;
  currentStart: string;
  currentEnd: string;
  priorStart: string;
  priorEnd: string;
};

function fmtDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(input: string, days: number): string {
  const d = new Date(`${input}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return fmtDate(d);
}

export function isValidToolInput(value: unknown): value is ToolInput {
  if (!value || typeof value !== "object") return false;
  const asRecord = value as Record<string, unknown>;
  return typeof asRecord.site === "string" && asRecord.site.trim().length > 0;
}

export async function resolveMcpProperty(userId: string, site: string): Promise<PropertyRow | null> {
  const resolved = await resolvePropertyForUser(userId, site);
  if (!resolved) return null;

  const prop = await readQuery<PropertyRow>(
    `SELECT id, team_id, site_url, gsc_site_url
     FROM properties
     WHERE id = $1 AND active = true
     LIMIT 1`,
    [resolved.propertyId]
  );

  return prop.rows[0] ?? null;
}

export async function getLatestSnapshotDate(propertyId: string): Promise<string | null> {
  const res = await readQuery<{ max: string | null }>(
    `SELECT MAX(date)::text AS max FROM property_snapshots WHERE property_id = $1`,
    [propertyId]
  );
  return res.rows[0]?.max ?? null;
}

export function buildDefaultWindow(latestDate: string): DateWindow {
  const currentEnd = latestDate;
  const currentStart = addDays(currentEnd, -27);
  const priorEnd = addDays(currentStart, -1);
  const priorStart = addDays(priorEnd, -27);

  return {
    latestDate,
    currentStart,
    currentEnd,
    priorStart,
    priorEnd,
  };
}

export function normalizeSiteLabel(siteUrl: string, gscSiteUrl: string | null): string {
  const raw = gscSiteUrl || siteUrl;
  if (!raw) return "unknown";
  if (raw.startsWith("sc-domain:")) {
    return raw.slice("sc-domain:".length);
  }
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return raw;
  }
}
