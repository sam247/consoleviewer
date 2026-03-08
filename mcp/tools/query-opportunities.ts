import { fetchOpportunitySourceRows } from "@/mcp/services/opportunity-data";
import { getLatestSnapshotDate, resolveMcpProperty } from "@/mcp/shared";
import { validateSiteScopedParams } from "@/mcp/validation";
import type { QueryOpportunityRow, ToolDefinition } from "@/mcp/types";

export const getQueryOpportunitiesTool: ToolDefinition<"get_query_opportunities"> = {
  name: "get_query_opportunities",
  description: "Return high-opportunity keyword queries using Consoleviewer's existing opportunity engine.",
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
  async handler(input, context): Promise<QueryOpportunityRow[]> {
    const property = context.validatedProperty ?? (await resolveMcpProperty(context.userId, input.site));
    if (!property) return [];

    const latestDate = await getLatestSnapshotDate(property.propertyId);
    if (!latestDate) return [];

    const rows = await fetchOpportunitySourceRows(property.propertyId, latestDate);

    return rows.map((row) => {
      const impressions = Number(row.impressions) || 0;
      const clicks = Number(row.clicks) || 0;
      return {
        query: row.query_text,
        impressions,
        position: impressions > 0 ? Number(row.position_sum) / impressions : 0,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        opportunity_score: Number(row.score) || 0,
      };
    });
  },
};
