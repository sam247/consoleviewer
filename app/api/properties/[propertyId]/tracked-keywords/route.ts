import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { sha256Hex } from "@/lib/etl/hash";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getSessionUserId } from "@/lib/session";
import { hasSerprobotKey, serprobotFetch } from "@/lib/serprobot";

type KeywordRow = {
  id: string;
  keyword: string;
  position: number;
  delta1d: number;
  delta7d: number;
  sparkData: number[];
};

function normalizeTargetUrl(siteUrl: string): string {
  try {
    const url = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`);
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return siteUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0] ?? siteUrl;
  }
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function extractRankPosition(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;

  const direct =
    coerceNumber(data.position) ??
    coerceNumber(data.rank) ??
    coerceNumber(data.pos);
  if (direct != null) return direct;

  for (const key of ["data", "result", "results", "serps", "records"]) {
    const value = data[key];
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (first && typeof first === "object") {
        const row = first as Record<string, unknown>;
        const pos = coerceNumber(row.position) ?? coerceNumber(row.rank) ?? coerceNumber(row.pos);
        if (pos != null) return pos;
      }
    }
  }
  return null;
}

async function resolveRequestContext(param: string) {
  const userId = await getSessionUserId();
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const resolved = await resolvePropertyForUser(userId, param);
  if (!resolved) return { error: NextResponse.json({ error: "Property not found" }, { status: 404 }) };

  return { userId, resolved };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const { propertyId: param } = await params;
  const ctx = await resolveRequestContext(param);
  if ("error" in ctx) return ctx.error;

  const { resolved } = ctx;
  const pool = getPool();

  const res = await pool.query<{
    id: string;
    keyword_text: string;
    position: number | null;
    delta1d: number | null;
    delta7d: number | null;
    spark_data: Array<number | null> | null;
  }>(
    `SELECT
       rk.id::text AS id,
       rk.keyword_text,
       latest.position,
       CASE
         WHEN latest.position IS NOT NULL AND prev1.position IS NOT NULL THEN latest.position - prev1.position
         ELSE NULL
       END AS delta1d,
       CASE
         WHEN latest.position IS NOT NULL AND prev7.position IS NOT NULL THEN latest.position - prev7.position
         ELSE NULL
       END AS delta7d,
       spark.spark_data
     FROM rank_keywords rk
     LEFT JOIN LATERAL (
       SELECT rp.position
       FROM rank_positions rp
       WHERE rp.keyword_id = rk.id
       ORDER BY rp.date DESC
       LIMIT 1
     ) latest ON TRUE
     LEFT JOIN LATERAL (
       SELECT rp.position
       FROM rank_positions rp
       WHERE rp.keyword_id = rk.id
       ORDER BY rp.date DESC
       OFFSET 1 LIMIT 1
     ) prev1 ON TRUE
     LEFT JOIN LATERAL (
       SELECT rp.position
       FROM rank_positions rp
       WHERE rp.keyword_id = rk.id
       ORDER BY rp.date DESC
       OFFSET 7 LIMIT 1
     ) prev7 ON TRUE
     LEFT JOIN LATERAL (
       SELECT ARRAY_AGG(x.position ORDER BY x.date) AS spark_data
       FROM (
         SELECT rp.date, rp.position
         FROM rank_positions rp
         WHERE rp.keyword_id = rk.id
         ORDER BY rp.date DESC
         LIMIT 7
       ) x
     ) spark ON TRUE
     WHERE rk.property_id = $1
       AND rk.active = true
     ORDER BY rk.created_at DESC`,
    [resolved.propertyId]
  );

  const keywords: KeywordRow[] = res.rows.map((row) => ({
    id: row.id,
    keyword: row.keyword_text,
    position: Number(row.position ?? 0),
    delta1d: Number(row.delta1d ?? 0),
    delta7d: Number(row.delta7d ?? 0),
    sparkData: (row.spark_data ?? [])
      .filter((n): n is number => typeof n === "number")
      .map((n) => Number(n)),
  }));

  return NextResponse.json({
    configured: true,
    canManageKeywords: true,
    keywords,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const { propertyId: param } = await params;
  const ctx = await resolveRequestContext(param);
  if ("error" in ctx) return ctx.error;

  const { resolved } = ctx;
  const pool = getPool();

  let body: { phrase?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const phrase = typeof body.phrase === "string" ? body.phrase.trim() : "";
  if (!phrase) {
    return NextResponse.json({ error: "phrase is required" }, { status: 400 });
  }

  const hashHex = sha256Hex(phrase);
  const upsert = await pool.query<{ id: string }>(
    `INSERT INTO rank_keywords (team_id, property_id, keyword_text, keyword_hash, active)
     VALUES ($1, $2, $3, decode($4, 'hex'), true)
     ON CONFLICT (property_id, keyword_hash) DO UPDATE
     SET keyword_text = EXCLUDED.keyword_text,
         active = true
     RETURNING id::text`,
    [resolved.teamId, resolved.propertyId, phrase, hashHex]
  );
  const keywordId = upsert.rows[0]?.id;

  let warning: string | undefined;
  let position: number | null = null;
  if (hasSerprobotKey()) {
    try {
      const propRes = await pool.query<{ site_url: string; gsc_site_url: string | null }>(
        `SELECT site_url, gsc_site_url FROM properties WHERE id = $1 LIMIT 1`,
        [resolved.propertyId]
      );
      const rawUrl = propRes.rows[0]?.gsc_site_url || propRes.rows[0]?.site_url;
      if (rawUrl) {
        const targetUrl = normalizeTargetUrl(rawUrl);
        const region = (process.env.SERPROBOT_GOOGLE_REGION ?? "www.google.com").trim();
        const check = await serprobotFetch("rank_check", {
          region,
          keyword: phrase,
          target_url: targetUrl,
        });
        position = extractRankPosition(check);
        if (position != null && keywordId) {
          await pool.query(
            `INSERT INTO rank_positions (team_id, property_id, keyword_id, date, position, url)
             VALUES ($1, $2, $3::uuid, CURRENT_DATE, $4::numeric, NULL)
             ON CONFLICT DO NOTHING`,
            [resolved.teamId, resolved.propertyId, keywordId, position]
          );
        }
      }
    } catch (error) {
      warning = error instanceof Error ? error.message : "SerpRobot rank_check failed";
    }
  } else {
    warning = "SERPROBOT_API_KEY is not set; keyword saved without live position check.";
  }

  return NextResponse.json({ ok: true, keywordId, position, warning });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const { propertyId: param } = await params;
  const ctx = await resolveRequestContext(param);
  if ("error" in ctx) return ctx.error;

  const { resolved } = ctx;
  const pool = getPool();

  const keywordId = request.nextUrl.searchParams.get("keywordId")?.trim();
  const phrase = request.nextUrl.searchParams.get("phrase")?.trim();
  if (!keywordId && !phrase) {
    return NextResponse.json({ error: "keywordId or phrase is required" }, { status: 400 });
  }

  if (keywordId) {
    await pool.query(
      `UPDATE rank_keywords
       SET active = false
       WHERE id = $1::uuid AND property_id = $2`,
      [keywordId, resolved.propertyId]
    );
  } else if (phrase) {
    const hashHex = sha256Hex(phrase);
    await pool.query(
      `UPDATE rank_keywords
       SET active = false
       WHERE property_id = $1
         AND keyword_hash = decode($2, 'hex')`,
      [resolved.propertyId, hashHex]
    );
  }

  return NextResponse.json({ ok: true });
}
