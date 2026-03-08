import {
  callMcp,
  createMcpCallBudgetContext,
  type AllowedAiMcpMethod,
  type CallMcpOptions,
  type McpCallBudgetContext,
} from "@/lib/mcp-client";
import { logAiToolExecution } from "@/lib/ai/ai-logs";
import { planTools } from "@/lib/ai/tool-planner";

export type McpShadowInput = {
  question: string;
  propertyId: string;
  userId: string;
  callBudgetContext?: McpCallBudgetContext;
  mcpOptions?: Omit<CallMcpOptions, "budgetContext">;
};

export type McpToolResult = {
  tool: AllowedAiMcpMethod;
  data: unknown;
};

export type McpShadowOutput = {
  usedMcp: boolean;
  toolCalled?: AllowedAiMcpMethod;
  toolSequence?: AllowedAiMcpMethod[];
  numberOfToolsUsed?: number;
  toolData?: unknown;
  toolResults?: McpToolResult[];
  promptContextText?: string;
  fallbackReason?: string;
};

function labelForTool(tool: AllowedAiMcpMethod): string {
  switch (tool) {
    case "explain_traffic_change":
      return "Traffic Change Analysis";
    case "get_query_opportunities":
      return "Query Opportunities";
    case "get_keyword_clusters":
      return "Keyword Clusters";
    case "suggest_content":
      return "Content Suggestions";
    case "get_site_overview":
      return "Site Overview";
    case "get_page_performance":
      return "Page Performance";
    case "get_recent_changes":
      return "Recent Changes";
    default:
      return tool;
  }
}

function buildPromptContext(toolResults: McpToolResult[], question: string): string {
  const sections = toolResults.map((item) => {
    return `${labelForTool(item.tool)}:\n${JSON.stringify(item.data, null, 2)}`;
  });

  return [
    "Use the following analytics data from Consoleviewer MCP to answer the user's question.",
    "Analytics Data:",
    ...sections,
    `User question: ${question}`,
  ].join("\n\n");
}

export async function runMcpShadowAssist(input: McpShadowInput): Promise<McpShadowOutput> {
  const startedAt = Date.now();
  const budgetContext = input.callBudgetContext ?? createMcpCallBudgetContext(10);

  const toolSequence = planTools(input.question);
  if (toolSequence.length === 0) {
    logAiToolExecution({
      timestamp: new Date().toISOString(),
      userId: input.userId,
      propertyId: input.propertyId,
      toolCalled: "none",
      toolSequence: [],
      numberOfToolsUsed: 0,
      executionTimeMs: Date.now() - startedAt,
      totalExecutionTimeMs: Date.now() - startedAt,
      status: "fallback",
    });

    return {
      usedMcp: false,
      toolSequence: [],
      numberOfToolsUsed: 0,
      fallbackReason: "no_intent_match",
    };
  }

  const toolResults: McpToolResult[] = [];
  let fallbackReason: string | undefined;

  for (const tool of toolSequence) {
    const result = await callMcp(tool, { site: input.propertyId }, {
      ...(input.mcpOptions ?? {}),
      budgetContext,
    });

    if (!result.ok) {
      fallbackReason = fallbackReason ?? `${result.type}:${result.message}`;
      if (result.type === "budget_exceeded") {
        break;
      }
      continue;
    }

    toolResults.push({
      tool,
      data: result.result,
    });
  }

  if (toolResults.length === 0) {
    logAiToolExecution({
      timestamp: new Date().toISOString(),
      userId: input.userId,
      propertyId: input.propertyId,
      toolCalled: "none",
      toolSequence,
      numberOfToolsUsed: 0,
      executionTimeMs: Date.now() - startedAt,
      totalExecutionTimeMs: Date.now() - startedAt,
      status: "fallback",
    });

    return {
      usedMcp: false,
      toolSequence,
      numberOfToolsUsed: 0,
      fallbackReason: fallbackReason ?? "all_tools_failed",
    };
  }

  const promptContextText = buildPromptContext(toolResults, input.question);
  const firstTool = toolResults[0]?.tool;

  logAiToolExecution({
    timestamp: new Date().toISOString(),
    userId: input.userId,
    propertyId: input.propertyId,
    toolCalled: firstTool ?? "none",
    toolSequence,
    numberOfToolsUsed: toolResults.length,
    executionTimeMs: Date.now() - startedAt,
    totalExecutionTimeMs: Date.now() - startedAt,
    status: "success",
  });

  return {
    usedMcp: true,
    toolCalled: firstTool,
    toolData: toolResults[0]?.data,
    toolSequence,
    numberOfToolsUsed: toolResults.length,
    toolResults,
    promptContextText,
    fallbackReason,
  };
}
