import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getPool } from "@/lib/db";

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

export async function GET(
  _request: NextRequest,
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
  const latestRes = await pool.query<{ max: string }>(
    `SELECT MAX(date)::text AS max FROM property_snapshots WHERE property_id = $1`,
    [resolved.propertyId]
  );
  const latestDate = latestRes.rows[0]?.max;
  if (!latestDate) {
    return NextResponse.json({ conflicts: [] });
  }

  const res = await pool.query<{
    query_text: string;
    conflict_score: number;
    page_ids: number[];
  }>(
    `SELECT q.query_text, c.conflict_score, c.page_ids
     FROM query_cannibalisation c
     JOIN query_dictionary q ON q.id = c.query_id
     WHERE c.property_id = $1 AND c.date = $2::date
     ORDER BY c.conflict_score DESC
     LIMIT 25`,
    [resolved.propertyId, latestDate]
  );

  const pageIds = new Set<string>();
  for (const row of res.rows) {
    if (Array.isArray(row.page_ids)) {
      row.page_ids.forEach((id: number | string) => pageIds.add(String(id)));
    }
  }
  const urlMap = new Map<string, string>();
  if (pageIds.size > 0) {
    const ids = Array.from(pageIds);
    const urlRes = await pool.query<{ id: string; page_url: string }>(
      `SELECT id::text AS id, page_url FROM page_dictionary WHERE id = ANY($1::bigint[])`,
      [ids.map((s) => String(s))]
    );
    urlRes.rows.forEach((r) => urlMap.set(r.id, r.page_url));
  }

  const conflicts: CannibalisationConflict[] = res.rows.map((r) => {
    const pageIdsArr = Array.isArray(r.page_ids) ? r.page_ids : [];
    const urls = pageIdsArr
      .map((id) => urlMap.get(String(id)))
      .filter(Boolean) as string[];
    return {
      query: r.query_text,
      impressions: 0,
      clicks: 0,
      numUrls: urls.length || pageIdsArr.length,
      bestPosition: 0,
      score: Number(r.conflict_score),
      urls: urls.map((page) => ({ page, clicks: 0, position: 0 })),
      primary_url: urls[0] ?? "",
    };
  });

  return NextResponse.json({ conflicts });
}
