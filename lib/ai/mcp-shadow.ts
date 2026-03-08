import {
  callMcp,
  createMcpCallBudgetContext,
  type AllowedAiMcpMethod,
  type CallMcpOptions,
  type McpCallBudgetContext,
} from "@/lib/mcp-client";
import { logAiToolExecution } from "@/lib/ai/ai-logs";
import { routeAiIntent } from "@/lib/ai/tool-router";

export type McpShadowInput = {
  question: string;
  propertyId: string;
  userId: string;
  callBudgetContext?: McpCallBudgetContext;
  mcpOptions?: Omit<CallMcpOptions, "budgetContext">;
};

export type McpShadowOutput = {
  usedMcp: boolean;
  toolCalled?: AllowedAiMcpMethod;
  toolData?: unknown;
  promptContextText?: string;
  fallbackReason?: string;
};

function buildPromptContext(toolCalled: AllowedAiMcpMethod, toolData: unknown, question: string): string {
  return [
    "Use the following analytics data from Consoleviewer MCP to answer the user's question.",
    `Tool: ${toolCalled}`,
    "Data:",
    JSON.stringify(toolData, null, 2),
    `User question: ${question}`,
  ].join("\n\n");
}

export async function runMcpShadowAssist(input: McpShadowInput): Promise<McpShadowOutput> {
  const startedAt = Date.now();
  const budgetContext = input.callBudgetContext ?? createMcpCallBudgetContext(10);

  const route = routeAiIntent(input.question);
  if (!route) {
    logAiToolExecution({
      timestamp: new Date().toISOString(),
      userId: input.userId,
      propertyId: input.propertyId,
      toolCalled: "none",
      executionTimeMs: Date.now() - startedAt,
      status: "fallback",
    });

    return {
      usedMcp: false,
      fallbackReason: "no_intent_match",
    };
  }

  const toolCalled = route.method;
  const params = route.paramsBuilder({ propertyId: input.propertyId });

  const result = await callMcp(toolCalled, params, {
    ...(input.mcpOptions ?? {}),
    budgetContext,
  });

  if (!result.ok) {
    logAiToolExecution({
      timestamp: new Date().toISOString(),
      userId: input.userId,
      propertyId: input.propertyId,
      toolCalled,
      executionTimeMs: result.durationMs,
      status: "fallback",
    });

    return {
      usedMcp: false,
      fallbackReason: `${result.type}:${result.message}`,
    };
  }

  const promptContextText = buildPromptContext(result.method, result.result, input.question);

  logAiToolExecution({
    timestamp: new Date().toISOString(),
    userId: input.userId,
    propertyId: input.propertyId,
    toolCalled,
    executionTimeMs: result.durationMs,
    status: "success",
  });

  return {
    usedMcp: true,
    toolCalled,
    toolData: result.result,
    promptContextText,
  };
}
