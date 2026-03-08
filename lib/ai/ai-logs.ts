import type { AllowedAiMcpMethod } from "@/lib/mcp-client";

type AiToolExecutionLog = {
  timestamp: string;
  userId: string;
  propertyId: string;
  toolCalled: AllowedAiMcpMethod | "none";
  executionTimeMs: number;
  totalExecutionTimeMs?: number;
  status: "success" | "fallback" | "error";
  toolSequence?: AllowedAiMcpMethod[];
  numberOfToolsUsed?: number;
};

export function logAiToolExecution(entry: AiToolExecutionLog): void {
  const sequence = entry.toolSequence && entry.toolSequence.length > 0
    ? entry.toolSequence.join(",")
    : "none";
  const toolsUsed = entry.numberOfToolsUsed ?? (entry.toolSequence?.length ?? 0);
  const totalMs = entry.totalExecutionTimeMs ?? entry.executionTimeMs;

  console.info(
    `[AI] ts=${entry.timestamp} user=${entry.userId} property=${entry.propertyId} tool=${entry.toolCalled} tools=${toolsUsed} sequence=${sequence} duration=${entry.executionTimeMs}ms total=${totalMs}ms status=${entry.status}`
  );
}
