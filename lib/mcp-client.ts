import type { ToolName } from "@/mcp/types";

export type AllowedAiMcpMethod =
  | "get_site_overview"
  | "get_query_opportunities"
  | "get_recent_changes"
  | "get_page_performance"
  | "get_keyword_clusters"
  | "explain_traffic_change"
  | "suggest_content"
  | "get_movement_summary"
  | "get_biggest_losers"
  | "get_biggest_winners"
  | "get_opportunities"
  | "get_projects_attention"
  | "get_404_pages";

const ALLOWED_METHODS = new Set<AllowedAiMcpMethod>([
  "get_site_overview",
  "get_query_opportunities",
  "get_recent_changes",
  "get_page_performance",
  "get_keyword_clusters",
  "explain_traffic_change",
  "suggest_content",
  "get_movement_summary",
  "get_biggest_losers",
  "get_biggest_winners",
  "get_opportunities",
  "get_projects_attention",
  "get_404_pages",
]);

export type McpCallBudgetContext = {
  maxCalls: number;
  callsMade: number;
};

export function createMcpCallBudgetContext(maxCalls = 10): McpCallBudgetContext {
  return { maxCalls, callsMade: 0 };
}

export type McpCallFailureType =
  | "not_whitelisted"
  | "timeout"
  | "rpc_error"
  | "network_error"
  | "budget_exceeded";

export type McpCallFailure = {
  ok: false;
  type: McpCallFailureType;
  method: string;
  durationMs: number;
  message: string;
  code?: number;
};

export type McpCallSuccess<T> = {
  ok: true;
  method: AllowedAiMcpMethod;
  durationMs: number;
  result: T;
};

export type McpCallResult<T> = McpCallSuccess<T> | McpCallFailure;

type JsonRpcSuccess<T> = {
  jsonrpc: "2.0";
  id: string;
  result: T;
};

type JsonRpcError = {
  jsonrpc: "2.0";
  id: string | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcError;

export type CallMcpOptions = {
  endpoint?: string;
  timeoutMs?: number;
  budgetContext?: McpCallBudgetContext;
  requestId?: string;
  headers?: Record<string, string>;
};

function isAllowedMethod(method: string): method is AllowedAiMcpMethod {
  return ALLOWED_METHODS.has(method as AllowedAiMcpMethod);
}

function makeRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function callMcp<T = unknown>(
  method: AllowedAiMcpMethod | ToolName,
  params: Record<string, unknown>,
  options: CallMcpOptions = {}
): Promise<McpCallResult<T>> {
  const startedAt = Date.now();

  if (!isAllowedMethod(method)) {
    return {
      ok: false,
      type: "not_whitelisted",
      method,
      durationMs: Date.now() - startedAt,
      message: `Method '${method}' is not allowed for AI shadow calls`,
    };
  }

  const budget = options.budgetContext;
  if (budget && budget.callsMade >= budget.maxCalls) {
    return {
      ok: false,
      type: "budget_exceeded",
      method,
      durationMs: Date.now() - startedAt,
      message: `MCP call budget exceeded (${budget.maxCalls} per assistant request)`,
    };
  }

  if (budget) {
    budget.callsMade += 1;
  }

  const timeoutMs = options.timeoutMs ?? 3000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(options.endpoint ?? "/api/ai/mcp", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: options.requestId ?? makeRequestId(),
        method,
        params,
      }),
      signal: controller.signal,
    });

    const json = (await res.json().catch(() => null)) as JsonRpcResponse<T> | null;
    const durationMs = Date.now() - startedAt;

    if (!json || typeof json !== "object" || !("jsonrpc" in json)) {
      return {
        ok: false,
        type: "network_error",
        method,
        durationMs,
        message: "Invalid MCP response payload",
      };
    }

    if ("error" in json) {
      return {
        ok: false,
        type: "rpc_error",
        method,
        durationMs,
        message: json.error.message,
        code: json.error.code,
      };
    }

    return {
      ok: true,
      method,
      durationMs,
      result: json.result,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        type: "timeout",
        method,
        durationMs,
        message: `MCP request timed out after ${timeoutMs}ms`,
      };
    }

    return {
      ok: false,
      type: "network_error",
      method,
      durationMs,
      message: error instanceof Error ? error.message : "Network error while calling MCP",
    };
  } finally {
    clearTimeout(timeout);
  }
}
