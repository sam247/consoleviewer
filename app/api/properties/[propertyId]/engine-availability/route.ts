import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getPool } from "@/lib/db";

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
  const [tokenRes, propRes] = await Promise.all([
    pool.query(`SELECT 1 FROM team_bing_tokens WHERE team_id = $1 LIMIT 1`, [resolved.teamId]),
    pool.query<{ bing_site_url: string | null }>(`SELECT bing_site_url FROM properties WHERE id = $1`, [resolved.propertyId]),
  ]);

  const bingConnected = (tokenRes.rowCount ?? 0) > 0;
  const bingMappedToProperty = !!propRes.rows[0]?.bing_site_url;

  // Analytics ready if Bing is connected, property is mapped, and Bing detail returns rows.
  let bingAnalyticsReady = false;
  if (bingConnected && bingMappedToProperty) {
    try {
      const startDate = request.nextUrl.searchParams.get("startDate");
      const endDate = request.nextUrl.searchParams.get("endDate");
      if (startDate && endDate) {
        const base = request.nextUrl.origin;
        const res = await fetch(
          `${base}/api/properties/${encodeURIComponent(param)}/bing/detail?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
          {
            headers: { cookie: request.headers.get("cookie") ?? "" },
            cache: "no-store",
          }
        );
        if (res.ok) {
          const json = (await res.json()) as { analyticsReady?: boolean };
          bingAnalyticsReady = json.analyticsReady === true;
        }
      }
    } catch {
      bingAnalyticsReady = false;
    }
  }

  return NextResponse.json({
    google: { connected: true, analyticsReady: true },
    bing: {
      connected: bingConnected,
      mapped: bingMappedToProperty,
      analyticsReady: bingAnalyticsReady,
    },
  });
}

