import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { resolvePropertyForUser } from "@/lib/property-resolver";
import { getSessionUserId } from "@/lib/session";

type Dimension = "query" | "page" | "keyword";

type SavedViewRow = {
  id: string;
  name: string;
  dimension: Dimension;
  state: unknown;
  created_at: string;
  updated_at: string;
};

function deriveBrandToken(siteUrl: string): string {
  try {
    const u = siteUrl.startsWith("http") ? new URL(siteUrl) : new URL(`https://${siteUrl}`);
    const host = u.host.replace(/^www\./, "");
    const first = host.split(".")[0] ?? host;
    return first.replace(/[-_]/g, " ").trim() || first;
  } catch {
    const trimmed = siteUrl.replace(/^https?:\/\//, "").replace(/^www\./, "");
    const first = trimmed.split(".")[0] ?? trimmed;
    return first.replace(/[-_]/g, " ").trim() || first;
  }
}

function defaultViews(dimension: Dimension, brandToken: string) {
  const brand = brandToken.trim();
  return [
    {
      name: "Brand queries",
      dimension,
      state: {
        textMode: "contains",
        text: brand,
        posMin: "",
        posMax: "",
        ctrMax: "",
        impressionsMin: "",
        clicksMin: "",
      },
    },
    {
      name: "Non-brand queries",
      dimension,
      state: {
        textMode: "not_contains",
        text: brand,
        posMin: "",
        posMax: "",
        ctrMax: "",
        impressionsMin: "",
        clicksMin: "",
      },
    },
    {
      name: "Low CTR high impressions",
      dimension,
      state: {
        textMode: "contains",
        text: "",
        posMin: "",
        posMax: "",
        ctrMax: "1.0",
        impressionsMin: "1000",
        clicksMin: "",
      },
    },
    {
      name: "Position 5–15",
      dimension,
      state: {
        textMode: "contains",
        text: "",
        posMin: "5",
        posMax: "15",
        ctrMax: "",
        impressionsMin: "",
        clicksMin: "",
      },
    },
  ];
}

async function ensureDefaults({
  ownerUserId,
  propertyId,
  dimension,
  siteUrl,
}: {
  ownerUserId: string;
  propertyId: string;
  dimension: Dimension;
  siteUrl: string;
}) {
  const pool = getPool();
  const existing = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM saved_views
     WHERE owner_user_id = $1 AND property_id = $2 AND dimension = $3`,
    [ownerUserId, propertyId, dimension]
  );
  const count = Number(existing.rows[0]?.count ?? "0");
  if (count > 0) return;

  const brandToken = deriveBrandToken(siteUrl);
  const defs = defaultViews(dimension, brandToken);
  const now = new Date().toISOString();

  for (const v of defs) {
    await pool.query(
      `INSERT INTO saved_views (owner_user_id, property_id, dimension, name, state, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $6::timestamptz)
       ON CONFLICT (owner_user_id, property_id, dimension, name)
       DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at`,
      [ownerUserId, propertyId, dimension, v.name, JSON.stringify(v.state), now]
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { propertyId } = await params;
  const resolved = await resolvePropertyForUser(userId, propertyId);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pool = getPool();
  const prop = await pool.query<{ site_url: string; gsc_site_url: string | null }>(
    `SELECT site_url, gsc_site_url FROM properties WHERE id = $1 LIMIT 1`,
    [resolved.propertyId]
  );
  const siteUrl = prop.rows[0]?.site_url ?? prop.rows[0]?.gsc_site_url;
  if (!siteUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dimensionParam = request.nextUrl.searchParams.get("dimension");
  if (dimensionParam !== "query" && dimensionParam !== "page" && dimensionParam !== "keyword") {
    return NextResponse.json({ error: "Invalid dimension" }, { status: 400 });
  }
  const dimension = dimensionParam;

  await ensureDefaults({ ownerUserId: userId, propertyId: resolved.propertyId, dimension, siteUrl });
  const res = await pool.query<SavedViewRow>(
    `SELECT id::text AS id,
            name,
            dimension,
            state,
            created_at::text AS created_at,
            updated_at::text AS updated_at
     FROM saved_views
     WHERE owner_user_id = $1 AND property_id = $2 AND dimension = $3
     ORDER BY updated_at DESC, name ASC`,
    [userId, resolved.propertyId, dimension]
  );

  return NextResponse.json({ views: res.rows });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { propertyId } = await params;
  const resolved = await resolvePropertyForUser(userId, propertyId);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as
    | { name?: string; dimension?: Dimension; state?: unknown }
    | null;
  const name = (body?.name ?? "").trim();
  const dimension = body?.dimension;
  const state = body?.state;
  if (!name || (dimension !== "query" && dimension !== "page" && dimension !== "keyword") || state == null) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const pool = getPool();
  const now = new Date().toISOString();
  const inserted = await pool.query<SavedViewRow>(
    `INSERT INTO saved_views (owner_user_id, property_id, dimension, name, state, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $6::timestamptz)
     ON CONFLICT (owner_user_id, property_id, dimension, name)
     DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at
     RETURNING id::text AS id,
               name,
               dimension,
               state,
               created_at::text AS created_at,
               updated_at::text AS updated_at`,
    [userId, resolved.propertyId, dimension, name, JSON.stringify(state), now]
  );

  return NextResponse.json({ view: inserted.rows[0] });
}
