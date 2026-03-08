import { resolveMcpProperty } from "@/mcp/shared";
import type { SiteScopedToolInput, ToolName, ValidatedProperty } from "@/mcp/types";

const NON_PROPERTY_SCOPED_TOOLS = new Set<ToolName>(["list_tools"]);

export function requiresPropertyAccess(method: ToolName): boolean {
  return !NON_PROPERTY_SCOPED_TOOLS.has(method);
}

export async function validatePropertyAccess(
  userId: string,
  method: ToolName,
  params: unknown
): Promise<{ ok: true; property?: ValidatedProperty } | { ok: false }> {
  if (!requiresPropertyAccess(method)) {
    return { ok: true };
  }

  if (!params || typeof params !== "object") {
    return { ok: false };
  }

  const { site } = params as SiteScopedToolInput;
  if (!site || typeof site !== "string") {
    return { ok: false };
  }

  const property = await resolveMcpProperty(userId, site);
  if (!property) {
    return { ok: false };
  }

  return { ok: true, property };
}
