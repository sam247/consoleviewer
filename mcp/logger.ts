import type { ToolName } from "@/mcp/types";

export function logMcpRequest(input: {
  userId: string;
  method: ToolName;
  propertyId?: string;
  site?: string;
}): void {
  const timestamp = new Date().toISOString();
  const property = input.propertyId ?? input.site ?? "n/a";
  console.info(`[MCP] ts=${timestamp} user=${input.userId} method=${input.method} property=${property}`);
}
