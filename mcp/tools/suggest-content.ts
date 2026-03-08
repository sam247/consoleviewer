import { fetchOpportunitySourceRows } from "@/mcp/services/opportunity-data";
import { getLatestSnapshotDate } from "@/mcp/shared";
import { validateSiteScopedParams } from "@/mcp/validation";
import type { SuggestedContentRecommendation, SuggestedContentResult, ToolDefinition } from "@/mcp/types";

function normalizeQuery(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function topicFromQuery(query: string): string {
  const cleaned = normalizeQuery(query);
  if (!cleaned) return "untitled topic";
  const tokens = cleaned.split(" ").slice(0, 4);
  return tokens.join(" ");
}

function classifyContentType(topic: string): string {
  if (/(price|cost|pricing|quote)/i.test(topic)) return "pricing guide";
  if (/(vs|compare|comparison|best)/i.test(topic)) return "comparison page";
  if (/(how|what|why|guide|tips)/i.test(topic)) return "informational guide";
  return "service landing page";
}

export const suggestContentTool: ToolDefinition<"suggest_content"> = {
  name: "suggest_content",
  description: "Suggest content opportunities from existing query opportunity analytics.",
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
  async handler(input, context): Promise<SuggestedContentResult> {
    const validated = context.validatedProperty;
    if (!validated) return { recommendations: [] };

    const latestDate = await getLatestSnapshotDate(validated.propertyId);
    if (!latestDate) return { recommendations: [] };

    const rows = await fetchOpportunitySourceRows(validated.propertyId, latestDate);
    if (rows.length === 0) return { recommendations: [] };

    const grouped = new Map<string, { demand: number; weightedPosition: number; score: number; queries: Set<string> }>();

    for (const row of rows) {
      const topic = topicFromQuery(row.query_text);
      const entry = grouped.get(topic) ?? {
        demand: 0,
        weightedPosition: 0,
        score: 0,
        queries: new Set<string>(),
      };

      const impressions = Number(row.impressions) || 0;
      const position = impressions > 0 ? Number(row.position_sum) / impressions : 0;
      entry.demand += impressions;
      entry.weightedPosition += position * impressions;
      entry.score += Number(row.score) || 0;
      entry.queries.add(row.query_text);
      grouped.set(topic, entry);
    }

    const recommendations: SuggestedContentRecommendation[] = Array.from(grouped.entries())
      .map(([topic, data]) => {
        const avgPos = data.demand > 0 ? data.weightedPosition / data.demand : 0;
        return {
          topic,
          search_demand: data.demand,
          current_rank: Math.round(avgPos * 100) / 100,
          opportunity_score: Math.round(data.score * 100) / 100,
          recommended_content_type: classifyContentType(topic),
        };
      })
      .sort((a, b) => b.opportunity_score - a.opportunity_score)
      .slice(0, 10);

    return { recommendations: recommendations.slice(0, Math.max(5, recommendations.length)) };
  },
};
