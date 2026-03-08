import { getRecentChangesTool } from "@/mcp/tools/recent-changes";
import { validateSiteScopedParams } from "@/mcp/validation";
import type { ToolDefinition, TrafficChangeDriver, TrafficChangeExplanationResult } from "@/mcp/types";

export const explainTrafficChangeTool: ToolDefinition<"explain_traffic_change"> = {
  name: "explain_traffic_change",
  description: "Explain traffic movement using existing recent ranking and click-change diagnostics.",
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
  async handler(input, context): Promise<TrafficChangeExplanationResult> {
    const recent = await getRecentChangesTool.handler(input, context);

    const candidateDrivers = [...recent.losses, ...recent.dropped_rankings]
      .map((row) => ({
        query: row.query,
        previous_position: Number(row.previous_position) || 0,
        current_position: Number(row.current_position) || 0,
        click_change: Number(row.clicks_change) || 0,
      }))
      .sort((a, b) => a.click_change - b.click_change)
      .slice(0, 10);

    const drivers: TrafficChangeDriver[] = candidateDrivers;
    const totalClickLoss = drivers.reduce((acc, row) => acc + row.click_change, 0);

    const summary =
      drivers.length > 0
        ? `Traffic declined due to ranking losses across ${drivers.length} queries (${totalClickLoss} net clicks).`
        : "No significant negative ranking drivers were detected in recent movement data.";

    return {
      summary,
      drivers,
    };
  },
};
