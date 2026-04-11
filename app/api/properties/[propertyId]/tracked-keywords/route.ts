import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { sha256Hex } from "@/lib/etl/hash";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getSessionUserId } from "@/lib/session";
import { hasSerprobotKey, serprobotFetch } from "@/lib/serprobot";

type KeywordRow = {
  id: string;
  keyword: string;
  position: number | null;
  delta1d: number;
  delta7d: number;
  delta30d: number;
  sparkData: number[];
  status: "checking" | "ready" | "error";
  lastCheckedAt: string | null;
  warning?: string;
};

function normalizeTargetUrl(siteUrl: string): string {
  const trimmed = siteUrl.trim();
  if (trimmed.startsWith("sc-domain:")) {
    return trimmed.slice("sc-domain:".length).replace(/^www\./i, "").replace(/\/+$/, "");
  }
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0] ?? trimmed;
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

  const POSITION_FIELDS = [
    "position", "rank", "pos",
    "target_position", "target_url_position", "ranking_position",
    "google_rank", "serp_position",
  ];

  for (const field of POSITION_FIELDS) {
    const v = coerceNumber(data[field]);
    if (v != null) return v;
  }

  for (const key of ["data", "result", "results", "serps", "records", "response"]) {
    const value = data[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      for (const field of POSITION_FIELDS) {
        const v = coerceNumber(nested[field]);
        if (v != null) return v;
      }
    }
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (first && typeof first === "object") {
        const row = first as Record<string, unknown>;
        for (const field of POSITION_FIELDS) {
          const v = coerceNumber(row[field]);
          if (v != null) return v;
        }
      }
    }
  }

  return null;
}

function createCorrelationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `tk-${Date.now().toString(36)}`;
}

function errorResponse(
  status: number,
  message: string,
  correlationId: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    { error: message, correlationId, ...(extra ?? {}) },
    { status, headers: { "x-correlation-id": correlationId } }
  );
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
  try {
    const { propertyId: param } = await params;
    const ctx = await resolveRequestContext(param);
    if ("error" in ctx) return ctx.error;

    const { resolved } = ctx;
    const pool = getPool();

    const res = await pool.query<{
      id: string;
      keyword_text: string;
      keyword_created_at: string;
      position: number | null;
      last_checked_at: string | null;
      delta1d: number | null;
      delta7d: number | null;
      delta30d: number | null;
      spark_data: Array<number | null> | null;
    }>(
      `SELECT
         rk.id::text AS id,
         rk.keyword_text,
         rk.created_at::text AS keyword_created_at,
         latest.position,
         latest.created_at::text AS last_checked_at,
         CASE
           WHEN latest.position IS NOT NULL AND prev1.position IS NOT NULL THEN latest.position - prev1.position
           ELSE NULL
         END AS delta1d,
         CASE
           WHEN latest.position IS NOT NULL AND prev7.position IS NOT NULL THEN latest.position - prev7.position
           ELSE NULL
         END AS delta7d,
         CASE
           WHEN latest.position IS NOT NULL AND prev30.position IS NOT NULL THEN latest.position - prev30.position
           ELSE NULL
         END AS delta30d,
         spark.spark_data
       FROM rank_keywords rk
       LEFT JOIN LATERAL (
         SELECT rp.position, rp.created_at
         FROM rank_positions rp
         WHERE rp.keyword_id = rk.id
         ORDER BY rp.date DESC, rp.created_at DESC
         LIMIT 1
       ) latest ON TRUE
       LEFT JOIN LATERAL (
         SELECT rp.position
         FROM rank_positions rp
         WHERE rp.keyword_id = rk.id
         ORDER BY rp.date DESC, rp.created_at DESC
         OFFSET 1 LIMIT 1
       ) prev1 ON TRUE
       LEFT JOIN LATERAL (
         SELECT rp.position
         FROM rank_positions rp
         WHERE rp.keyword_id = rk.id
         ORDER BY rp.date DESC, rp.created_at DESC
         OFFSET 7 LIMIT 1
       ) prev7 ON TRUE
       LEFT JOIN LATERAL (
         SELECT rp.position
         FROM rank_positions rp
         WHERE rp.keyword_id = rk.id
         ORDER BY rp.date DESC, rp.created_at DESC
         OFFSET 30 LIMIT 1
       ) prev30 ON TRUE
       LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(x.position ORDER BY x.date) AS spark_data
         FROM (
          SELECT rp.date, rp.position::float8 AS position
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

    const pendingWindowMs = 15 * 60 * 1000;
    const nowMs = Date.now();

    const keywords: KeywordRow[] = res.rows.map((row) => {
      const keywordCreatedAtMs = Date.parse(row.keyword_created_at);
      const lastCheckedAtMs = row.last_checked_at ? Date.parse(row.last_checked_at) : NaN;

      let status: KeywordRow["status"] = "ready";
      let warning: string | undefined;

      if (row.position == null) {
        if (Number.isFinite(lastCheckedAtMs)) {
          status = "error";
          warning = "Latest rank check returned no position from SerpRobot.";
        } else {
          const withinPendingWindow =
            Number.isFinite(keywordCreatedAtMs) && nowMs - keywordCreatedAtMs < pendingWindowMs;
          status = withinPendingWindow ? "checking" : "error";
          if (status === "error") {
            warning = "No recent rank data returned from SerpRobot yet.";
          }
        }
      }

      return {
        id: row.id,
        keyword: row.keyword_text,
        position: row.position != null ? Number(row.position) : null,
        delta1d: Number(row.delta1d ?? 0),
        delta7d: Number(row.delta7d ?? 0),
        delta30d: Number(row.delta30d ?? 0),
        sparkData: (row.spark_data ?? [])
          .map((n) => coerceNumber(n))
          .filter((n): n is number => n != null),
        status,
        lastCheckedAt: row.last_checked_at,
        warning,
      };
    });

    return NextResponse.json({
      configured: true,
      canManageKeywords: true,
      keywords,
    });
  } catch (error) {
    const correlationId = createCorrelationId();
    const message = error instanceof Error ? error.message : "Failed to load tracked keywords";
    return errorResponse(500, message, correlationId);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId: param } = await params;
    const ctx = await resolveRequestContext(param);
    if ("error" in ctx) return ctx.error;

    const { resolved } = ctx;
    const pool = getPool();

    let body: { phrase?: string; region?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const phrase = typeof body.phrase === "string" ? body.phrase.trim() : "";
    const clientRegion = typeof body.region === "string" ? body.region.trim() : "";
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
    let status: KeywordRow["status"] = "checking";
    let lastCheckedAt: string | null = null;

    if (hasSerprobotKey()) {
      try {
        const propRes = await pool.query<{ site_url: string; gsc_site_url: string | null }>(
          `SELECT site_url, gsc_site_url FROM properties WHERE id = $1 LIMIT 1`,
          [resolved.propertyId]
        );
        const siteUrl = propRes.rows[0]?.site_url?.trim();
        const gscSiteUrl = propRes.rows[0]?.gsc_site_url?.trim();
        const rawUrl = siteUrl || gscSiteUrl;
        if (rawUrl) {
          const targetUrl = normalizeTargetUrl(rawUrl);
          const region = clientRegion || (process.env.SERPROBOT_GOOGLE_REGION ?? "www.google.co.uk").trim();
          const checkParams = { region, keyword: phrase, target_url: targetUrl };
          const check = await serprobotFetch("rank_check", checkParams);
          position = extractRankPosition(check);
          lastCheckedAt = new Date().toISOString();
          if (keywordId) {
            await pool.query(
              `INSERT INTO rank_positions (team_id, property_id, keyword_id, date, position, url)
               VALUES ($1, $2, $3::uuid, CURRENT_DATE, $4::numeric, NULL)
               ON CONFLICT DO NOTHING`,
              [resolved.teamId, resolved.propertyId, keywordId, position]
            );
          }
          if (position != null) {
            status = "ready";
          } else {
            status = "error";
            warning = `Rank check returned no matching position. Check Vercel logs for the full SerpRobot response (region: ${region}, target: ${targetUrl}).`;
          }
        } else {
          status = "error";
          warning = "Property URL is missing, so rank_check could not run.";
        }
      } catch (error) {
        warning = error instanceof Error ? error.message : "SerpRobot rank_check failed";
        status = "error";
      }
    } else {
      warning = "SERPROBOT_API_KEY is not set; keyword saved without live position check.";
      status = "error";
    }

    return NextResponse.json({ ok: true, keywordId, position, status, lastCheckedAt, warning });
  } catch (error) {
    const correlationId = createCorrelationId();
    const message = error instanceof Error ? error.message : "Failed to add tracked keyword";
    return errorResponse(500, message, correlationId);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
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
  } catch (error) {
    const correlationId = createCorrelationId();
    const message = error instanceof Error ? error.message : "Failed to remove tracked keyword";
    return errorResponse(500, message, correlationId);
  }
}
