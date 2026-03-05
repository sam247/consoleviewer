import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getPool } from "@/lib/db";
import { getSiteDetail } from "@/lib/gsc";

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { data: unknown; expires: number }>();

function cacheKey(propertyId: string, startDate: string, endDate: string): string {
  return `${propertyId}:${startDate}:${endDate}`;
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

  const pool = getPool();
  const propRes = await pool.query<{ site_url: string; gsc_site_url: string | null }>(
    `SELECT site_url, gsc_site_url FROM properties WHERE id = $1`,
    [resolved.propertyId]
  );
  const siteUrl = propRes.rows[0]?.site_url ?? null;
  const gscSiteUrl = propRes.rows[0]?.gsc_site_url ?? null;
  if (!siteUrl && !gscSiteUrl) {
    return NextResponse.json({ error: "Property has no site URL" }, { status: 400 });
  }
  const gscUrl = gscSiteUrl ?? (siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`);

  const sp = request.nextUrl.searchParams;
  const startDate = sp.get("startDate");
  const endDate = sp.get("endDate");
  const priorStartDate = sp.get("priorStartDate");
  const priorEndDate = sp.get("priorEndDate");
  if (!startDate || !endDate || !priorStartDate || !priorEndDate) {
    return NextResponse.json(
      { error: "Missing startDate, endDate, priorStartDate, or priorEndDate" },
      { status: 400 }
    );
  }

  const key = cacheKey(param, startDate, endDate);
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expires) {
    return NextResponse.json(cached.data);
  }

  let brandedTerms: string[] | undefined;
  const brandedParam = sp.get("brandedTerms");
  if (brandedParam) {
    try {
      const parsed = JSON.parse(brandedParam) as unknown;
      if (Array.isArray(parsed)) {
        brandedTerms = parsed.filter((t): t is string => typeof t === "string");
      }
    } catch {
      // ignore invalid branded terms
    }
  }

  try {
    const data = await getSiteDetail(
      gscUrl,
      startDate,
      endDate,
      priorStartDate,
      priorEndDate,
      brandedTerms
    );
    cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(data);
  } catch (e) {
    console.error("[detail]", e);
    return NextResponse.json(
      { error: "Failed to fetch site detail" },
      { status: 500 }
    );
  }
}
