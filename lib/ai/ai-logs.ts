import type { AllowedAiMcpMethod } from "@/lib/mcp-client";

type AiToolExecutionLog = {
  timestamp: string;
  userId: string;
  propertyId: string;
  toolCalled: AllowedAiMcpMethod | "none";
  executionTimeMs: number;
  status: "success" | "fallback" | "error";
};

export function logAiToolExecution(entry: AiToolExecutionLog): void {
  console.info(
    `[AI] ts=${entry.timestamp} user=${entry.userId} property=${entry.propertyId} tool=${entry.toolCalled} duration=${entry.executionTimeMs}ms status=${entry.status}`
  );
}
