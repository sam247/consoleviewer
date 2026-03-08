import { readQuery } from "@/mcp/db";
import { buildDefaultWindow, getLatestSnapshotDate, resolveMcpProperty } from "@/mcp/shared";
import { validateSiteScopedParams } from "@/mcp/validation";
import type { KeywordClusterRow, ToolDefinition } from "@/mcp/types";

type QueryAggregateRow = {
  query_text: string;
  impressions: number;
  position_sum: number;
};

type ClassifiedQueryRow = QueryAggregateRow & {
  category: string | null;
  labels: string[] | null;
};

function rootKeywordFromQuery(query: string): string {
  const cleaned = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "other";

  const stop = new Set(["a", "an", "and", "for", "how", "in", "of", "on", "or", "the", "to", "what", "why", "with"]);
  const tokens = cleaned.split(" ").filter((token) => token && !stop.has(token));
  if (tokens.length === 0) return "other";
  return tokens.slice(0, 2).join(" ");
}

function clusterRows<T extends QueryAggregateRow>(rows: T[], clusterPicker: (row: T) => string): KeywordClusterRow[] {
  const clusters = new Map<string, { queries: string[]; impressions: number; positionSum: number }>();
  for (const row of rows) {
    const cluster = clusterPicker(row) || "other";
    const entry = clusters.get(cluster) ?? { queries: [], impressions: 0, positionSum: 0 };
    entry.queries.push(row.query_text);
    entry.impressions += Number(row.impressions) || 0;
    entry.positionSum += Number(row.position_sum) || 0;
    clusters.set(cluster, entry);
  }

  return Array.from(clusters.entries())
    .map(([cluster, value]) => ({
      cluster,
      queries: Array.from(new Set(value.queries)).slice(0, 20),
      total_impressions: value.impressions,
      avg_position: value.impressions > 0 ? value.positionSum / value.impressions : 0,
    }))
    .sort((a, b) => b.total_impressions - a.total_impressions)
    .slice(0, 25);
}

export const getKeywordClustersTool: ToolDefinition<"get_keyword_clusters"> = {
  name: "get_keyword_clusters",
  description: "Return grouped query themes using query_classification first, with a root-keyword fallback.",
  inputSchema: {
    type: "object",
    properties: {
      site: { type: "string", description: "Consoleviewer property UUID or encoded property ID" },
      startDate: { type: "string", description: "Optional YYYY-MM-DD (validated, ignored in v1)" },
      endDate: { type: "string", description: "Optional YYYY-MM-DD (validated, ignored in v1)" },
    },
    required: ["site"],
    additionalProperties: false,
  },
  validate: validateSiteScopedParams,
  async handler(input, context): Promise<KeywordClusterRow[]> {
    const property = context.validatedProperty ?? (await resolveMcpProperty(context.userId, input.site));
    if (!property) return [];

    const latestDate = await getLatestSnapshotDate(property.propertyId);
    if (!latestDate) return [];

    const window = buildDefaultWindow(latestDate);

    const classifiedRes = await readQuery<ClassifiedQueryRow>(
      `SELECT
         q.query_text,
         SUM(g.impressions)::int AS impressions,
         SUM(g.position_sum)::numeric AS position_sum,
         qc.category,
         qc.labels
       FROM gsc_query_daily g
       JOIN query_dictionary q ON q.id = g.query_id
       LEFT JOIN query_classification qc ON qc.property_id = g.property_id AND qc.query_id = g.query_id
       WHERE g.property_id = $1
         AND g.date BETWEEN $2::date AND $3::date
       GROUP BY g.query_id, q.query_text, qc.category, qc.labels
       ORDER BY SUM(g.impressions) DESC
       LIMIT 300`,
      [property.propertyId, window.currentStart, window.currentEnd]
    );

    const hasClassification = classifiedRes.rows.some(
      (row) => (row.category && row.category.trim().length > 0) || (Array.isArray(row.labels) && row.labels.length > 0)
    );

    if (hasClassification) {
      return clusterRows(classifiedRes.rows, (row) => {
        const category = row.category?.trim();
        if (category) return category;
        const firstLabel = Array.isArray(row.labels) ? row.labels?.[0]?.trim() : "";
        return firstLabel || rootKeywordFromQuery(row.query_text);
      });
    }

    const fallbackRows = classifiedRes.rows.map((row) => ({
      query_text: row.query_text,
      impressions: row.impressions,
      position_sum: row.position_sum,
    }));

    return clusterRows(fallbackRows, (row) => rootKeywordFromQuery(row.query_text));
  },
};
