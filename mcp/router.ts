import { logMcpRequest } from "@/mcp/logger";
import { validatePropertyAccess } from "@/mcp/middleware/validate-property";
import { explainTrafficChangeTool } from "@/mcp/tools/explain-traffic-change";
import { explainTrafficDropTool } from "@/mcp/tools/explain-traffic-drop";
import { getKeywordClustersTool } from "@/mcp/tools/keyword-clusters";
import { createListToolsTool } from "@/mcp/tools/list-tools";
import { getPagePerformanceTool } from "@/mcp/tools/page-performance";
import { getQueryOpportunitiesTool } from "@/mcp/tools/query-opportunities";
import { getRecentChangesTool } from "@/mcp/tools/recent-changes";
import { getSiteOverviewTool } from "@/mcp/tools/site-overview";
import { suggestContentTool } from "@/mcp/tools/suggest-content";
import { getMovementSummaryTool } from "@/mcp/tools/movement-summary";
import { getBiggestLosersTool } from "@/mcp/tools/biggest-losers";
import { getBiggestWinnersTool } from "@/mcp/tools/biggest-winners";
import { getOpportunitiesTool } from "@/mcp/tools/opportunities-v2";
import { getProjectsAttentionTool } from "@/mcp/tools/projects-attention";
import type { RPCRequest, RPCResponse, ToolContext, ToolDefinition, ToolDescriptor, ToolName } from "@/mcp/types";

export const JSON_RPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: "Parse error" },
  INVALID_REQUEST: { code: -32600, message: "Invalid Request" },
  METHOD_NOT_FOUND: { code: -32601, message: "Method not found" },
  INVALID_PARAMS: { code: -32602, message: "Invalid params" },
  INTERNAL_ERROR: { code: -32603, message: "Internal error" },
  UNAUTHORIZED: { code: -32001, message: "Unauthorized" },
  RATE_LIMIT: { code: -32002, message: "Rate limit exceeded" },
  FORBIDDEN: { code: -32003, message: "Forbidden" },
} as const;

function errorResponse(
  id: string | number | null,
  error: { code: number; message: string },
  data?: unknown
): RPCResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: error.code,
      message: error.message,
      ...(data === undefined ? {} : { data }),
    },
  };
}

function isRpcRequest(payload: unknown): payload is RPCRequest {
  if (!payload || typeof payload !== "object") return false;
  const r = payload as Record<string, unknown>;
  const idType = typeof r.id;
  const validId = r.id === null || idType === "string" || idType === "number";
  return r.jsonrpc === "2.0" && typeof r.method === "string" && validId;
}

const tools = {} as Record<ToolName, ToolDefinition<ToolName>>;

function buildToolDescriptors(): ToolDescriptor[] {
  return Object.values(tools).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Record<string, unknown>,
  }));
}

Object.assign(tools, {
  list_tools: createListToolsTool(buildToolDescriptors),
  get_site_overview: getSiteOverviewTool,
  get_query_opportunities: getQueryOpportunitiesTool,
  get_recent_changes: getRecentChangesTool,
  get_page_performance: getPagePerformanceTool,
  get_keyword_clusters: getKeywordClustersTool,
  explain_traffic_drop: explainTrafficDropTool,
  explain_traffic_change: explainTrafficChangeTool,
  suggest_content: suggestContentTool,
  get_movement_summary: getMovementSummaryTool,
  get_biggest_losers: getBiggestLosersTool,
  get_biggest_winners: getBiggestWinnersTool,
  get_opportunities: getOpportunitiesTool,
  get_projects_attention: getProjectsAttentionTool,
});

export function listTools(): ToolDescriptor[] {
  return buildToolDescriptors();
}

export async function routeRpcRequest(payload: unknown, context: ToolContext | null): Promise<RPCResponse> {
  if (Array.isArray(payload)) {
    return errorResponse(null, JSON_RPC_ERRORS.INVALID_REQUEST, "Batch requests are not supported in MCP v1");
  }

  if (!isRpcRequest(payload)) {
    return errorResponse(null, JSON_RPC_ERRORS.INVALID_REQUEST);
  }

  if (!context?.userId) {
    return errorResponse(payload.id, JSON_RPC_ERRORS.UNAUTHORIZED);
  }

  const tool = tools[payload.method as ToolName];
  if (!tool) {
    return errorResponse(payload.id, JSON_RPC_ERRORS.METHOD_NOT_FOUND);
  }

  if (!tool.validate(payload.params)) {
    return errorResponse(payload.id, JSON_RPC_ERRORS.INVALID_PARAMS, { expected: tool.inputSchema });
  }

  const propertyCheck = await validatePropertyAccess(context.userId, payload.method, payload.params);
  if (!propertyCheck.ok) {
    return errorResponse(payload.id, JSON_RPC_ERRORS.FORBIDDEN);
  }

  const site = payload.params && typeof payload.params === "object" ? (payload.params as { site?: string }).site : undefined;
  logMcpRequest({
    userId: context.userId,
    method: payload.method,
    propertyId: propertyCheck.property?.propertyId,
    site,
  });

  try {
    const result = await tool.handler(payload.params, {
      ...context,
      validatedProperty: propertyCheck.property,
    });

    return {
      jsonrpc: "2.0",
      id: payload.id,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(payload.id, JSON_RPC_ERRORS.INTERNAL_ERROR, { message });
  }
}
