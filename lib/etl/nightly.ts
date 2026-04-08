import { getPool } from "@/lib/db";
import { getAccessToken } from "@/lib/google-auth";
import { getAccessTokenForTeam } from "@/lib/gsc-tokens";
import { querySearchAnalytics } from "@/lib/gsc";
import { serprobotFetch, hasSerprobotKey } from "@/lib/serprobot";
import { sha256Hex } from "@/lib/etl/hash";
import type { SerpRobotKeyword, SerpRobotProject } from "@/types/serprobot";

const ROW_LIMIT = Number(process.env.ETL_ROW_LIMIT ?? 25000);
const BACKFILL_DAYS = Number(process.env.ETL_BACKFILL_DAYS ?? 30);
const MAX_RAW_ROWS = Number(process.env.ETL_MAX_RAW_ROWS ?? 200000);

type EtlMode = "nightly" | "backfill";

export type EtlOptions = {
  mode?: EtlMode;
  backfillDays?: number;
  advanceWatermark?: boolean;
  cursor?: string;
  propertyLimit?: number;
};

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeHost(siteUrl: string): string {
  try {
    const url = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.toLowerCase();
  } catch {
    return siteUrl.replace(/^www\./, "").toLowerCase();
  }
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

async function fetchAllRows(
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  accessToken?: string | null
) {
  const rows: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] = [];
  let startRow = 0;
  while (true) {
    const res = await withRetry(() =>
      querySearchAnalytics(siteUrl, startDate, endDate, dimensions, { rowLimit: ROW_LIMIT, startRow }, accessToken)
    );
    const batch = res.rows ?? [];
    rows.push(...batch);
    if (batch.length < ROW_LIMIT) break;
    startRow += ROW_LIMIT;
  }
  return rows;
}

async function upsertDictionary(
  table: "query_dictionary" | "page_dictionary",
  items: { text: string; hashHex: string }[]
): Promise<Map<string, number>> {
  const client = await getPool().connect();
  try {
    const unique = new Map<string, string>();
    for (const item of items) {
      if (!unique.has(item.hashHex)) unique.set(item.hashHex, item.text);
    }
    const hashes = Array.from(unique.keys());
    if (hashes.length === 0) return new Map();

    const hashColumn = table === "query_dictionary" ? "query_hash" : "page_hash";
    const existing = await client.query(
      `SELECT id, encode(${hashColumn}, 'hex') AS hash
       FROM ${table === "query_dictionary" ? "query_dictionary" : "page_dictionary"}
       WHERE encode(${hashColumn}, 'hex') = ANY($1)`,
      [hashes]
    );

    const map = new Map<string, number>();
    for (const row of existing.rows) {
      map.set(row.hash, Number(row.id));
    }

    const missing = hashes.filter((h) => !map.has(h));
    if (missing.length > 0) {
      const texts = missing.map((h) => unique.get(h) ?? "");
      if (table === "query_dictionary") {
        await client.query(
          `INSERT INTO query_dictionary (query_hash, query_text)
           SELECT decode(h, 'hex'), t
           FROM UNNEST($1::text[], $2::text[]) AS x(h, t)
           ON CONFLICT (query_hash) DO NOTHING`,
          [missing, texts]
        );
      } else {
        await client.query(
          `INSERT INTO page_dictionary (page_hash, page_url)
           SELECT decode(h, 'hex'), t
           FROM UNNEST($1::text[], $2::text[]) AS x(h, t)
           ON CONFLICT (page_hash) DO NOTHING`,
          [missing, texts]
        );
      }

      const inserted = await client.query(
        `SELECT id, encode(${table === "query_dictionary" ? "query_hash" : "page_hash"}, 'hex') AS hash
         FROM ${table}
         WHERE encode(${table === "query_dictionary" ? "query_hash" : "page_hash"}, 'hex') = ANY($1)`,
        [missing]
      );
      for (const row of inserted.rows) {
        map.set(row.hash, Number(row.id));
      }
    }

    return map;
  } finally {
    client.release();
  }
}

async function insertRawRows(
  propertyId: string,
  rows: { date: string; queryHash: string; pageHash: string; clicks: number; impressions: number; position: number }[]
) {
  const client = await getPool().connect();
  try {
    const chunkSize = 1000;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const dates = chunk.map((r) => r.date);
      const qhash = chunk.map((r) => r.queryHash);
      const phash = chunk.map((r) => r.pageHash);
      const clicks = chunk.map((r) => r.clicks);
      const impressions = chunk.map((r) => r.impressions);
      const positions = chunk.map((r) => r.position);

      try {
        await client.query(
          `INSERT INTO gsc_raw (property_id, date, query_hash, page_hash, clicks, impressions, position)
           SELECT $1, d::date, decode(qh, 'hex'), decode(ph, 'hex'), c::int, i::int, p::numeric
           FROM UNNEST($2::text[], $3::text[], $4::text[], $5::int[], $6::int[], $7::numeric[]) AS x(d, qh, ph, c, i, p)`,
          [propertyId, dates, qhash, phash, clicks, impressions, positions]
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Raw data is partitioned by date; if partitions are missing, continue ETL so
        // daily aggregates and snapshots still update.
        if (msg.includes("no partition of relation") && msg.includes("gsc_raw")) {
          console.warn("Skipping gsc_raw insert due to missing partition:", msg);
          continue;
        }
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

async function upsertPropertyDaily(
  teamId: string,
  propertyId: string,
  rows: { date: string; clicks: number; impressions: number; positionSum: number }[]
) {
  const client = await getPool().connect();
  try {
    const chunkSize = 1000;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const dates = chunk.map((r) => r.date);
      const clicks = chunk.map((r) => r.clicks);
      const impressions = chunk.map((r) => r.impressions);
      const posSum = chunk.map((r) => r.positionSum);

      await client.query(
        `INSERT INTO gsc_property_daily (team_id, property_id, date, clicks, impressions, position_sum)
         SELECT $1, $2, d::date, c::int, i::int, p::numeric
         FROM UNNEST($3::text[], $4::int[], $5::int[], $6::numeric[]) AS x(d, c, i, p)
         ON CONFLICT (property_id, date) DO UPDATE
         SET clicks = EXCLUDED.clicks,
             impressions = EXCLUDED.impressions,
             position_sum = EXCLUDED.position_sum`,
        [teamId, propertyId, dates, clicks, impressions, posSum]
      );
    }
  } finally {
    client.release();
  }
}

async function upsertQueryDaily(
  teamId: string,
  propertyId: string,
  rows: { date: string; queryId: number; clicks: number; impressions: number; positionSum: number }[]
) {
  const client = await getPool().connect();
  try {
    const chunkSize = 1000;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const dates = chunk.map((r) => r.date);
      const ids = chunk.map((r) => r.queryId);
      const clicks = chunk.map((r) => r.clicks);
      const impressions = chunk.map((r) => r.impressions);
      const posSum = chunk.map((r) => r.positionSum);

      await client.query(
        `INSERT INTO gsc_query_daily (team_id, property_id, date, query_id, clicks, impressions, position_sum)
         SELECT $1, $2, d::date, q::bigint, c::int, i::int, p::numeric
         FROM UNNEST($3::text[], $4::bigint[], $5::int[], $6::int[], $7::numeric[]) AS x(d, q, c, i, p)
         ON CONFLICT (property_id, date, query_id) DO UPDATE
         SET clicks = EXCLUDED.clicks,
             impressions = EXCLUDED.impressions,
             position_sum = EXCLUDED.position_sum`,
        [teamId, propertyId, dates, ids, clicks, impressions, posSum]
      );
    }
  } finally {
    client.release();
  }
}

async function upsertPageDaily(
  teamId: string,
  propertyId: string,
  rows: { date: string; pageId: number; clicks: number; impressions: number; positionSum: number }[]
) {
  const client = await getPool().connect();
  try {
    const chunkSize = 1000;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const dates = chunk.map((r) => r.date);
      const ids = chunk.map((r) => r.pageId);
      const clicks = chunk.map((r) => r.clicks);
      const impressions = chunk.map((r) => r.impressions);
      const posSum = chunk.map((r) => r.positionSum);

      await client.query(
        `INSERT INTO gsc_page_daily (team_id, property_id, date, page_id, clicks, impressions, position_sum)
         SELECT $1, $2, d::date, p::bigint, c::int, i::int, ps::numeric
         FROM UNNEST($3::text[], $4::bigint[], $5::int[], $6::int[], $7::numeric[]) AS x(d, p, c, i, ps)
         ON CONFLICT (property_id, date, page_id) DO UPDATE
         SET clicks = EXCLUDED.clicks,
             impressions = EXCLUDED.impressions,
             position_sum = EXCLUDED.position_sum`,
        [teamId, propertyId, dates, ids, clicks, impressions, posSum]
      );
    }
  } finally {
    client.release();
  }
}

async function computeDerivedTables(propertyId: string, teamId: string, startDate: string, endDate: string) {
  const client = await getPool().connect();
  try {
    await client.query(
      `DELETE FROM opportunity_queries WHERE property_id = $1 AND date BETWEEN $2 AND $3`,
      [propertyId, startDate, endDate]
    );
    await client.query(
      `INSERT INTO opportunity_queries (team_id, property_id, date, query_id, score, clicks, impressions, position_sum)
       SELECT
         team_id,
         property_id,
         date,
         query_id,
         (impressions * (1 - clicks::numeric / NULLIF(impressions, 0)) * GREATEST(0, 20 - (position_sum / NULLIF(impressions, 0))))::numeric(12,3) AS score,
         clicks,
         impressions,
         position_sum
       FROM gsc_query_daily
       WHERE property_id = $1 AND date BETWEEN $2 AND $3`,
      [propertyId, startDate, endDate]
    );

    await client.query(
      `DELETE FROM ranking_movements WHERE property_id = $1 AND date BETWEEN $2 AND $3`,
      [propertyId, startDate, endDate]
    );
    await client.query(
      `INSERT INTO ranking_movements (team_id, property_id, date, query_id, page_id, delta_1d, delta_7d, trend)
       SELECT
         cur.team_id,
         cur.property_id,
         cur.date,
         cur.query_id,
         NULL::bigint AS page_id,
         (cur.position_sum / NULLIF(cur.impressions,0)) - (prev1.position_sum / NULLIF(prev1.impressions,0)) AS delta_1d,
         (cur.position_sum / NULLIF(cur.impressions,0)) - (prev7.position_sum / NULLIF(prev7.impressions,0)) AS delta_7d,
         CASE
           WHEN (cur.position_sum / NULLIF(cur.impressions,0)) - (prev1.position_sum / NULLIF(prev1.impressions,0)) < 0 THEN 'up'
           WHEN (cur.position_sum / NULLIF(cur.impressions,0)) - (prev1.position_sum / NULLIF(prev1.impressions,0)) > 0 THEN 'down'
           ELSE 'flat'
         END AS trend
       FROM gsc_query_daily cur
       LEFT JOIN gsc_query_daily prev1
         ON prev1.property_id = cur.property_id
        AND prev1.query_id = cur.query_id
        AND prev1.date = cur.date - INTERVAL '1 day'
       LEFT JOIN gsc_query_daily prev7
         ON prev7.property_id = cur.property_id
        AND prev7.query_id = cur.query_id
        AND prev7.date = cur.date - INTERVAL '7 day'
       WHERE cur.property_id = $1 AND cur.date BETWEEN $2 AND $3`,
      [propertyId, startDate, endDate]
    );

    await client.query(
      `DELETE FROM query_cannibalisation WHERE property_id = $1 AND date BETWEEN $2 AND $3`,
      [propertyId, startDate, endDate]
    );
    await client.query(
      `INSERT INTO query_cannibalisation (team_id, property_id, date, query_id, conflict_score, page_ids)
       SELECT
         $2::uuid AS team_id,
         $1::uuid AS property_id,
         r.date,
         q.id AS query_id,
         COUNT(DISTINCT p.id)::numeric(12,3) AS conflict_score,
         ARRAY_AGG(DISTINCT p.id) AS page_ids
       FROM gsc_raw r
       JOIN query_dictionary q ON encode(q.query_hash, 'hex') = encode(r.query_hash, 'hex')
       JOIN page_dictionary p ON encode(p.page_hash, 'hex') = encode(r.page_hash, 'hex')
       WHERE r.property_id = $1 AND r.date BETWEEN $3 AND $4
       GROUP BY r.date, q.id
       HAVING COUNT(DISTINCT p.id) > 1`,
      [propertyId, teamId, startDate, endDate]
    );
  } finally {
    client.release();
  }
}

async function upsertQueryClassification(propertyId: string, teamId: string, startDate: string, endDate: string) {
  const client = await getPool().connect();
  try {
    const res = await client.query(
      `SELECT DISTINCT q.id, q.query_text
       FROM gsc_query_daily d
       JOIN query_dictionary q ON q.id = d.query_id
       WHERE d.property_id = $1 AND d.date BETWEEN $2 AND $3`,
      [propertyId, startDate, endDate]
    );

    const rules: { label: string; re: RegExp }[] = [
      { label: "transactional", re: /\b(buy|price|pricing|quote|cost|deal|cheap|booking)\b/i },
      { label: "navigational", re: /\b(login|signin|dashboard|portal|account)\b/i },
      { label: "informational", re: /\b(how|what|why|guide|best|tips|vs)\b/i },
      { label: "local", re: /\b(near me|nearby|in [a-z]+|city|town)\b/i },
    ];

    for (const row of res.rows) {
      const text = String(row.query_text ?? "");
      const labels = rules.filter((r) => r.re.test(text)).map((r) => r.label);
      const intent = labels[0] ?? "unknown";
      await client.query(
        `INSERT INTO query_classification (team_id, property_id, query_id, intent, category, labels, updated_at)
         VALUES ($1, $2, $3, $4, NULL, $5::text[], now())
         ON CONFLICT (property_id, query_id) DO UPDATE
         SET intent = EXCLUDED.intent,
             labels = EXCLUDED.labels,
             updated_at = now()`,
        [teamId, propertyId, row.id, intent, labels]
      );
    }
  } finally {
    client.release();
  }
}

async function updateSnapshots(propertyId: string, teamId: string, startDate: string, endDate: string) {
  const client = await getPool().connect();
  try {
    await client.query(
      `WITH q AS (
         SELECT date,
           COUNT(*) AS query_count,
           COUNT(*) FILTER (WHERE (position_sum / NULLIF(impressions,0)) <= 3) AS top3_count,
           COUNT(*) FILTER (WHERE (position_sum / NULLIF(impressions,0)) <= 10) AS top10_count
         FROM gsc_query_daily
         WHERE property_id = $1 AND date BETWEEN $2 AND $3
         GROUP BY date
       )
       INSERT INTO property_snapshots (team_id, property_id, date, clicks, impressions, position_sum, query_count, top3_count, top10_count)
       SELECT gp.team_id, gp.property_id, gp.date, gp.clicks, gp.impressions, gp.position_sum,
              COALESCE(q.query_count,0), COALESCE(q.top3_count,0), COALESCE(q.top10_count,0)
       FROM gsc_property_daily gp
       LEFT JOIN q ON q.date = gp.date
       WHERE gp.property_id = $1 AND gp.date BETWEEN $2 AND $3
       ON CONFLICT (property_id, date) DO UPDATE
       SET clicks = EXCLUDED.clicks,
           impressions = EXCLUDED.impressions,
           position_sum = EXCLUDED.position_sum,
           query_count = EXCLUDED.query_count,
           top3_count = EXCLUDED.top3_count,
           top10_count = EXCLUDED.top10_count`,
      [propertyId, startDate, endDate]
    );

    await client.query(
      `INSERT INTO property_chart_cache (team_id, property_id, date, clicks, impressions, position_sum)
       SELECT team_id, property_id, date, clicks, impressions, position_sum
       FROM gsc_property_daily
       WHERE property_id = $1 AND date BETWEEN $2 AND $3
       ON CONFLICT (property_id, date) DO UPDATE
       SET clicks = EXCLUDED.clicks,
           impressions = EXCLUDED.impressions,
           position_sum = EXCLUDED.position_sum`,
      [propertyId, startDate, endDate]
    );

    await client.query(
      `WITH opp AS (
         SELECT date, SUM(score) AS opportunity_score
         FROM opportunity_queries
         WHERE property_id = $1 AND date BETWEEN $2 AND $3
         GROUP BY date
       ),
       deltas AS (
         SELECT date,
           clicks - LAG(clicks) OVER (ORDER BY date) AS delta_clicks
         FROM gsc_property_daily
         WHERE property_id = $1 AND date BETWEEN $2 AND $3
       )
       INSERT INTO property_scores (team_id, property_id, date, visibility_score, momentum_score, opportunity_score)
       SELECT
         gp.team_id,
         gp.property_id,
         gp.date,
         (gp.clicks + gp.impressions * 0.01)::numeric(8,3) AS visibility_score,
         COALESCE(d.delta_clicks, 0)::numeric(8,3) AS momentum_score,
         COALESCE(opp.opportunity_score, 0)::numeric(8,3) AS opportunity_score
       FROM gsc_property_daily gp
       LEFT JOIN opp ON opp.date = gp.date
       LEFT JOIN deltas d ON d.date = gp.date
       WHERE gp.property_id = $1 AND gp.date BETWEEN $2 AND $3
       ON CONFLICT (property_id, date) DO UPDATE
       SET visibility_score = EXCLUDED.visibility_score,
           momentum_score = EXCLUDED.momentum_score,
           opportunity_score = EXCLUDED.opportunity_score`,
      [propertyId, startDate, endDate]
    );
  } finally {
    client.release();
  }
}

async function updateWatermark(propertyId: string, source: string, date: string) {
  const client = await getPool().connect();
  try {
    await client.query(
      `INSERT INTO etl_watermarks (property_id, source, last_processed_date, updated_at)
       VALUES ($1, $2, $3::date, now())
       ON CONFLICT (property_id, source) DO UPDATE
       SET last_processed_date = EXCLUDED.last_processed_date,
           updated_at = now()`,
      [propertyId, source, date]
    );
  } finally {
    client.release();
  }
}

async function getWatermark(propertyId: string, source: string): Promise<string | null> {
  const client = await getPool().connect();
  try {
    const res = await client.query(
      `SELECT last_processed_date FROM etl_watermarks WHERE property_id = $1 AND source = $2`,
      [propertyId, source]
    );
    return res.rows[0]?.last_processed_date ?? null;
  } finally {
    client.release();
  }
}

async function ingestGscForProperty(
  property: { id: string; team_id: string; site_url: string; gsc_site_url: string | null },
  options: EtlOptions
) {
  const endDate = toDateString(addDays(new Date(), -1));
  const mode = options.mode ?? "nightly";
  const backfillDays = Math.max(1, options.backfillDays ?? BACKFILL_DAYS);
  const watermark = await getWatermark(property.id, "gsc");
  const startDate =
    mode === "backfill"
      ? toDateString(addDays(new Date(endDate), -backfillDays + 1))
      : watermark
        ? toDateString(addDays(new Date(watermark), 1))
        : toDateString(addDays(new Date(), -BACKFILL_DAYS));
  if (startDate > endDate) return { startDate, endDate, processed: false };

  const accessToken = (await getAccessTokenForTeam(property.team_id)) ?? (await getAccessToken());
  if (!accessToken) return { startDate, endDate, processed: false };

  const siteUrl = property.gsc_site_url || property.site_url;

  const propertyDailyRows = await fetchAllRows(siteUrl, startDate, endDate, ["date"], accessToken);
  const queryDailyRows = await fetchAllRows(siteUrl, startDate, endDate, ["date", "query"], accessToken);
  const pageDailyRows = await fetchAllRows(siteUrl, startDate, endDate, ["date", "page"], accessToken);
  const rawRows = await fetchAllRows(siteUrl, startDate, endDate, ["date", "query", "page"], accessToken);

  if (rawRows.length > MAX_RAW_ROWS) {
    throw new Error(`Raw rows exceeded limit (${rawRows.length} > ${MAX_RAW_ROWS})`);
  }

  const queryItems = queryDailyRows.map((r) => ({ text: r.keys[1] ?? "", hashHex: sha256Hex(r.keys[1] ?? "") }));
  const pageItems = pageDailyRows.map((r) => ({ text: r.keys[1] ?? "", hashHex: sha256Hex(r.keys[1] ?? "") }));

  const queryMap = await upsertDictionary("query_dictionary", queryItems);
  const pageMap = await upsertDictionary("page_dictionary", pageItems);

  const rawPrepared = rawRows.map((r) => ({
    date: r.keys[0] ?? "",
    queryHash: sha256Hex(r.keys[1] ?? ""),
    pageHash: sha256Hex(r.keys[2] ?? ""),
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    position: r.position ?? 0,
  }));

  await insertRawRows(property.id, rawPrepared);

  const propDaily = propertyDailyRows.map((r) => {
    const impressions = r.impressions ?? 0;
    const position = r.position ?? 0;
    return {
      date: r.keys[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions,
      positionSum: position * impressions,
    };
  });

  const queryDaily = queryDailyRows.map((r) => {
    const queryText = r.keys[1] ?? "";
    const queryId = queryMap.get(sha256Hex(queryText)) ?? 0;
    const impressions = r.impressions ?? 0;
    const position = r.position ?? 0;
    return {
      date: r.keys[0] ?? "",
      queryId,
      clicks: r.clicks ?? 0,
      impressions,
      positionSum: position * impressions,
    };
  }).filter((r) => r.queryId !== 0);

  const pageDaily = pageDailyRows.map((r) => {
    const pageText = r.keys[1] ?? "";
    const pageId = pageMap.get(sha256Hex(pageText)) ?? 0;
    const impressions = r.impressions ?? 0;
    const position = r.position ?? 0;
    return {
      date: r.keys[0] ?? "",
      pageId,
      clicks: r.clicks ?? 0,
      impressions,
      positionSum: position * impressions,
    };
  }).filter((r) => r.pageId !== 0);

  await upsertPropertyDaily(property.team_id, property.id, propDaily);
  await upsertQueryDaily(property.team_id, property.id, queryDaily);
  await upsertPageDaily(property.team_id, property.id, pageDaily);

  await computeDerivedTables(property.id, property.team_id, startDate, endDate);
  await upsertQueryClassification(property.id, property.team_id, startDate, endDate);
  await updateSnapshots(property.id, property.team_id, startDate, endDate);

  if (mode === "nightly" || options.advanceWatermark !== false) {
    await updateWatermark(property.id, "gsc", endDate);
  }
  return { startDate, endDate, processed: true };
}

async function ingestKeywordsForProperty(
  property: { id: string; team_id: string; site_url: string },
  options: EtlOptions
) {
  if (!hasSerprobotKey()) return { processed: false };

  const endDate = toDateString(addDays(new Date(), -1));
  const mode = options.mode ?? "nightly";
  const watermark = await getWatermark(property.id, "keyword_tracking");
  const startDate =
    mode === "backfill"
      ? endDate
      : watermark
        ? toDateString(addDays(new Date(watermark), 1))
        : endDate;
  if (startDate > endDate) return { processed: false };

  const projectsRes = (await serprobotFetch("list_projects")) as { projects?: SerpRobotProject[]; data?: SerpRobotProject[] };
  const projects = projectsRes.projects ?? projectsRes.data ?? [];
  const propertyHost = normalizeHost(property.site_url);
  const project = projects.find((p) => normalizeHost(p.name) === propertyHost);
  if (!project) return { processed: false };

  const kwRes = (await serprobotFetch("keyword", { project_id: project.id })) as { keywords?: SerpRobotKeyword[]; data?: SerpRobotKeyword[] };
  const keywords = kwRes.keywords ?? kwRes.data ?? [];

  const client = await getPool().connect();
  try {
    for (const k of keywords) {
      const phrase = k.phrase ?? "";
      if (!phrase) continue;
      const hash = sha256Hex(phrase);

      const insertKw = await client.query(
        `INSERT INTO rank_keywords (team_id, property_id, keyword_text, keyword_hash)
         VALUES ($1, $2, $3, decode($4, 'hex'))
         ON CONFLICT (property_id, keyword_hash) DO UPDATE
         SET keyword_text = EXCLUDED.keyword_text
         RETURNING id`,
        [property.team_id, property.id, phrase, hash]
      );
      const keywordId = insertKw.rows[0]?.id;

      await client.query(
        `INSERT INTO rank_positions (team_id, property_id, keyword_id, date, position, url)
         VALUES ($1, $2, $3, $4::date, $5::numeric, $6)
         ON CONFLICT DO NOTHING`,
        [property.team_id, property.id, keywordId, endDate, k.position ?? null, k.url ?? null]
      );
    }
  } finally {
    client.release();
  }

  if (mode === "nightly" || options.advanceWatermark !== false) {
    await updateWatermark(property.id, "keyword_tracking", endDate);
  }
  return { processed: true };
}

export async function runNightlyEtl(options: EtlOptions = {}) {
  const client = await getPool().connect();
  let runId: string | null = null;
  try {
    const run = await client.query(
      `INSERT INTO etl_runs (job_name, status)
       VALUES ('nightly_etl', 'running')
       RETURNING id`
    );
    runId = run.rows[0].id;
  } finally {
    client.release();
  }

  let totalRows = 0;
  let failed = false;
  let errorMessage = "";

  const limit = Math.max(1, Math.min(25, Number(options.propertyLimit ?? 3)));
  const cursor = options.cursor?.trim() || null;
  const propsRes = cursor
    ? await getPool().query(
        `SELECT id, team_id, site_url, gsc_site_url
         FROM properties
         WHERE active = true AND id > $1
         ORDER BY id
         LIMIT $2`,
        [cursor, limit]
      )
    : await getPool().query(
        `SELECT id, team_id, site_url, gsc_site_url
         FROM properties
         WHERE active = true
         ORDER BY id
         LIMIT $1`,
        [limit]
      );

  for (const property of propsRes.rows) {
    try {
      const gscResult = await ingestGscForProperty(property, options);
      if (gscResult.processed) {
        totalRows += 1;
      }
      await ingestKeywordsForProperty(property, options);
    } catch (err) {
      failed = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }
  }

  await getPool().query(
    `UPDATE etl_runs
     SET status = $1, finished_at = now(), rows_processed = $2, error = $3
     WHERE id = $4`,
    [failed ? "failed" : "success", totalRows, failed ? errorMessage : null, runId]
  );

  const lastRow = propsRes.rows[propsRes.rows.length - 1] as { id?: string } | undefined;
  const nextCursor = propsRes.rows.length === limit ? (lastRow?.id ?? null) : null;
  return {
    ok: !failed,
    runId,
    processedProperties: totalRows,
    failed,
    nextCursor,
    done: nextCursor == null,
  };
}
