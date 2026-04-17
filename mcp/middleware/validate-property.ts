import { resolveMcpProperty } from "@/mcp/shared";
import type { SiteScopedToolInput, ToolName, ValidatedProperty } from "@/mcp/types";

const NON_PROPERTY_SCOPED_TOOLS = new Set<ToolName>(["list_tools"]);

function isAnalyticsTool(method: ToolName): boolean {
  return (
    method === "get_movement_summary" ||
    method === "get_biggest_losers" ||
    method === "get_biggest_winners" ||
    method === "get_opportunities" ||
    method === "get_projects_attention" ||
    method === "get_404_pages"
  );
}

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

  if (isAnalyticsTool(method)) {
    if (!params || typeof params !== "object") return { ok: false };
    const scope = (params as any).scope;
    if (scope === "all_projects") return { ok: true };
    if (scope !== "project") return { ok: false };
    const projectId = (params as any).project_id;
    if (!projectId || typeof projectId !== "string") return { ok: false };
    const property = await resolveMcpProperty(userId, projectId);
    if (!property) return { ok: false };
    return { ok: true, property };
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
