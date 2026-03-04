import { getPool } from "@/lib/db";
import { decodePropertyId } from "@/types/gsc";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normalize GSC site URL for lookup (match GSC import logic).
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

export type ResolvedProperty = { propertyId: string; teamId: string };

/**
 * Resolve the route segment (UUID or base64-encoded site URL) to a property UUID
 * that belongs to the user's team. Returns null if not found or not authorized.
 */
export async function resolvePropertyForUser(
  userId: string,
  param: string
): Promise<ResolvedProperty | null> {
  if (!param?.trim()) return null;
  const pool = getPool();

  if (UUID_REGEX.test(param)) {
    const res = await pool.query<{ id: string; team_id: string }>(
      `SELECT p.id, p.team_id FROM properties p
       INNER JOIN team_members tm ON tm.team_id = p.team_id
       WHERE p.id = $1 AND tm.user_id = $2 AND p.active = true LIMIT 1`,
      [param, userId]
    );
    const row = res.rows[0];
    return row ? { propertyId: row.id, teamId: row.team_id } : null;
  }

  let decoded: string;
  try {
    decoded = decodePropertyId(param);
  } catch {
    return null;
  }
  const normalized = normalizeSiteUrl(decoded);
  if (!normalized) return null;

  const res = await pool.query<{ id: string; team_id: string }>(
    `SELECT p.id, p.team_id FROM properties p
     INNER JOIN team_members tm ON tm.team_id = p.team_id
     WHERE tm.user_id = $1 AND p.active = true
       AND (p.site_url = $2 OR p.gsc_site_url = $2 OR p.gsc_site_url = $3)
     LIMIT 1`,
    [userId, normalized, decoded]
  );
  const row = res.rows[0];
  return row ? { propertyId: row.id, teamId: row.team_id } : null;
}
